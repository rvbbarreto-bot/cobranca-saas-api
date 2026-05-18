import { execSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { DEMO_PUBLIC_TENANT_UUID, runSeedPortalHappyPath } from "./seed-portal-happy-path";
import { upsertEscritorioAsaasConfig } from "./upsert-escritorio-asaas-config";
import { insertCharge } from "../modules/billing-core/infrastructure/charge-repository";
import { insertChargeEvent } from "../modules/billing-core/infrastructure/charge-events-repository";
import { processPaymentEmission } from "../platform/jobs/application/payment-emission-processor";
import { createAsaasAdapterFromEnv } from "../modules/payment-gateway/infrastructure/asaas/asaas-adapter";
import { withTenantTransaction } from "../platform/persistence/with-tenant-transaction";
import { insertWebhookInbox } from "../modules/inbox/infrastructure/webhook-inbox-repository";
import { processPendingWebhooksForTenant } from "../modules/inbox/application/process-webhook-inbox";
import { countChargeEvents } from "../modules/billing-core/infrastructure/charge-events-repository";

export type AsaasE2EEvidence = {
  executedAt: string;
  git: { branch: string; commit: string };
  environment: {
    nodeEnv: string;
    asaasApiUrl: string;
    databaseUrl: string;
    hasAsaasApiKey: boolean;
    hasEncryptionKey: boolean;
    hasWebhookSecret: boolean;
  };
  tenantPublicId: string;
  automacaoTenantId: string;
  correlationId: string;
  steps: Record<string, unknown>;
  assertions: { name: string; ok: boolean; detail?: string }[];
  automatedTestsNote: string;
};

function maskDbUrl(url: string): string {
  return url.replace(/:([^:@/]+)@/, ":***@");
}

function gitField(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function assert(evidence: AsaasE2EEvidence, name: string, ok: boolean, detail?: string): void {
  evidence.assertions.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`Assertion failed: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

export async function runAsaasSandboxE2E(connectionString: string): Promise<AsaasE2EEvidence> {
  const asaasKey = process.env.ASAAS_API_KEY?.trim();
  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  if (!asaasKey) {
    throw new Error("ASAAS_API_KEY obrigatoria para E2E Asaas Sandbox.");
  }
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY obrigatoria para E2E.");
  }

  const correlationId = `e2e-${Date.now()}`;
  const evidence: AsaasE2EEvidence = {
    executedAt: new Date().toISOString(),
    git: {
      branch: gitField("git rev-parse --abbrev-ref HEAD"),
      commit: gitField("git rev-parse HEAD")
    },
    environment: {
      nodeEnv: process.env.NODE_ENV ?? "development",
      asaasApiUrl: process.env.ASAAS_API_URL?.trim() || "https://sandbox.asaas.com/api/v3",
      databaseUrl: maskDbUrl(connectionString),
      hasAsaasApiKey: true,
      hasEncryptionKey: true,
      hasWebhookSecret: Boolean(process.env.WEBHOOK_INBOX_SECRET?.trim())
    },
    tenantPublicId: DEMO_PUBLIC_TENANT_UUID,
    automacaoTenantId: "",
    correlationId,
    steps: {},
    assertions: [],
    automatedTestsNote: "Execute: npm test && npm run test:integration && npm run e2e:asaas:evidence (este runner)."
  };

  const seed = await runSeedPortalHappyPath(connectionString);
  evidence.automacaoTenantId = seed.automacaoTenantId;

  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();
  let portalClienteId = "";
  let chargeId = "";
  let gatewayPaymentId = "";
  const ref = `e2e-asaas-${Date.now()}`;
  const idem = `idem-e2e-${Date.now()}`;

  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [DEMO_PUBLIC_TENANT_UUID]);
    await upsertEscritorioAsaasConfig(client, DEMO_PUBLIC_TENANT_UUID, asaasKey);

    const doc = "39053344705";
    const insCliente = await client.query<{ id: string }>(
      `INSERT INTO portal.cliente (tenant_id, documento, nome, email, tipo_documento)
       VALUES ($1, $2, $3, $4, 'cpf')
       ON CONFLICT (tenant_id, documento) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id::text AS id`,
      [seed.automacaoTenantId, doc, "Pagador E2E Asaas", `e2e+${Date.now()}@local.dev`]
    );
    portalClienteId = insCliente.rows[0]!.id;
    evidence.steps.portalClienteId = portalClienteId;

    const created = await insertCharge(client, {
      reference: ref,
      idempotencyKey: idem,
      amount: 10.5,
      dueDate: "2030-12-15",
      metadata: { portal_cliente_id: portalClienteId, descricao: "E2E Asaas Sandbox", competencia: "2030-12" }
    });
    chargeId = created.charge.id;
    if (created.inserted) {
      await insertChargeEvent(client, {
        tenantId: DEMO_PUBLIC_TENANT_UUID,
        chargeId,
        eventType: "charge.created",
        oldStatus: null,
        newStatus: created.charge.canonicalStatus,
        payload: { reference: ref, correlationId }
      });
    }
    await client.query("COMMIT");

    evidence.steps.createCharge = {
      chargeId,
      reference: ref,
      idempotency_key: idem,
      canonicalStatus: created.charge.canonicalStatus
    };

    assert(evidence, "cobranca_interna_rascunho", created.charge.canonicalStatus === "rascunho");

    await processPaymentEmission({ chargeId, tenantId: DEMO_PUBLIC_TENANT_UUID });

    const afterEmission = await withTenantTransaction(DEMO_PUBLIC_TENANT_UUID, async (c) => {
      const ch = await c.query(
        `SELECT canonical_status, provider, provider_charge_id FROM charges WHERE id = $1::uuid`,
        [chargeId]
      );
      const pt = await c.query(
        `SELECT gateway_transaction_id, status, boleto_url, gateway_raw_response IS NOT NULL AS has_raw
         FROM payment_transactions WHERE charge_id = $1::uuid LIMIT 1`,
        [chargeId]
      );
      const ev = await c.query(
        `SELECT event_type, old_status, new_status FROM charge_events WHERE charge_id = $1::uuid ORDER BY created_at`,
        [chargeId]
      );
      return { ch: ch.rows[0], pt: pt.rows[0], events: ev.rows };
    });

    gatewayPaymentId = String(afterEmission.pt?.gateway_transaction_id ?? "");
    evidence.steps.afterEmission = afterEmission;

    assert(evidence, "provider_charge_id_persistido", Boolean(afterEmission.ch?.provider_charge_id));
    assert(evidence, "payment_transaction_com_raw", Boolean(afterEmission.pt?.has_raw));
    assert(
      evidence,
      "charge_event_emissao",
      afterEmission.events.some((e) => e.event_type === "emissao_gateway")
    );

    const adapter = createAsaasAdapterFromEnv();
    const snapshot = await adapter.getCharge(gatewayPaymentId);
    evidence.steps.asaasGetCharge = snapshot;
    assert(evidence, "consulta_asaas_sandbox", Boolean(snapshot.status));

    const webhookPayload = {
      event: "PAYMENT_RECEIVED",
      payment: {
        id: gatewayPaymentId,
        status: "RECEIVED",
        externalReference: idem
      }
    };
    const extEventId = `asaas-e2e-${gatewayPaymentId}-received`;

    await withTenantTransaction(DEMO_PUBLIC_TENANT_UUID, async (c) => {
      const ins = await insertWebhookInbox(c, {
        source: "asaas",
        externalEventId: extEventId,
        payload: webhookPayload,
        correlationId
      });
      evidence.steps.webhookFirstInsert = ins;
      assert(evidence, "webhook_inbox_inserido", ins.inserted);
    });

    const proc1 = await processPendingWebhooksForTenant(DEMO_PUBLIC_TENANT_UUID, 50);
    evidence.steps.webhookProcessFirst = proc1;
    assert(evidence, "webhook_processado", proc1.updated >= 1);

    const eventsAfterWebhook = await withTenantTransaction(DEMO_PUBLIC_TENANT_UUID, async (c) =>
      countChargeEvents(c, chargeId, "webhook_asaas")
    );
    evidence.steps.webhookChargeEventsCount = eventsAfterWebhook;
    assert(evidence, "charge_event_webhook", eventsAfterWebhook === 1);

    await withTenantTransaction(DEMO_PUBLIC_TENANT_UUID, async (c) => {
      const dup = await insertWebhookInbox(c, {
        source: "asaas",
        externalEventId: extEventId,
        payload: webhookPayload,
        correlationId
      });
      evidence.steps.webhookDuplicateInsert = dup;
      assert(evidence, "webhook_dedup_inbox", dup.inserted === false);
    });

    const proc2 = await processPendingWebhooksForTenant(DEMO_PUBLIC_TENANT_UUID, 50);
    evidence.steps.webhookProcessDuplicate = proc2;

    const eventsAfterDup = await withTenantTransaction(DEMO_PUBLIC_TENANT_UUID, async (c) =>
      countChargeEvents(c, chargeId, "webhook_asaas")
    );
    assert(evidence, "webhook_idempotente_sem_evento_duplicado", eventsAfterDup === 1);

    const finalCharge = await withTenantTransaction(DEMO_PUBLIC_TENANT_UUID, async (c) => {
      const r = await c.query(`SELECT canonical_status FROM charges WHERE id = $1::uuid`, [chargeId]);
      return r.rows[0]?.canonical_status;
    });
    evidence.steps.finalCanonicalStatus = finalCharge;
    assert(evidence, "status_final_paga", finalCharge === "paga");

    return evidence;
  } finally {
    client.release();
    await pool.end();
  }
}

export function writeAsaasE2EEvidenceReport(evidence: AsaasE2EEvidence, outDir?: string): string {
  const dir = outDir ?? join(process.cwd(), "docs", "evidencias");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `asaas-e2e-${evidence.executedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(evidence, null, 2), "utf8");
  return file;
}
