import pg from "pg";
import { DEMO_PUBLIC_TENANT_UUID, runSeedPortalHappyPath } from "./seed-portal-happy-path";
import {
  buildFiscalHomologTestsNote,
  gitField,
  maskDbUrl,
  recordFiscalAssertion,
  type FiscalHomologE2EEvidence,
  writeFiscalHomologE2EEvidenceReport
} from "./fiscal-e2e-evidence-utils";
import { insertWebhookInbox } from "../modules/inbox/infrastructure/webhook-inbox-repository";
import { processPendingWebhooksForTenant } from "../modules/inbox/application/process-webhook-inbox";
import { handleFiscalCaptureInboxPayload } from "../modules/fiscal-guias/application/handle-fiscal-capture-inbox";
import { processFiscalCaptureJob } from "../platform/jobs/application/fiscal-capture-processor";
import type { ReceitaFiscalGateway } from "../modules/fiscal-guias/domain/receita-gateway.interface";
import type { TipoGuia } from "../modules/fiscal-guias/domain/schemas/guia-fiscal.schema";
import { createReceitaFiscalGateway } from "../modules/fiscal-guias/infrastructure/receita/http-receita-fiscal-gateway";
import { insertCertificadoDigital } from "../modules/fiscal-guias/infrastructure/certificado-digital-repository";
import { insertProcuracao } from "../modules/fiscal-guias/infrastructure/procuracao-repository";
import { withTenantTransaction } from "../platform/persistence/with-tenant-transaction";
import { processNotificationSend } from "../platform/jobs/application/notification-send-processor";
import { resetObjectStorageCache } from "../platform/storage/get-object-storage";
import { closePool } from "../platform/persistence/pool";

export type { FiscalHomologE2EEvidence };
export { writeFiscalHomologE2EEvidenceReport };

const FAKE_CERT =
  "-----BEGIN CERTIFICATE-----\n" + "A".repeat(120) + "\n-----END CERTIFICATE-----";
const FAKE_KEY =
  "-----BEGIN PRIVATE KEY-----\n" + "B".repeat(120) + "\n-----END PRIVATE KEY-----";

const TEST_CNPJ = "11222333000181";

type GuiaRow = {
  id: string;
  status: string;
  tipo_guia: string;
  compliance_status: string;
  pdf_url: string | null;
  pdf_storage_key: string | null;
  valor_total: string;
};

function periodoApuracaoFromCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  if (!y || !m) {
    return "2032-12-31";
  }
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

async function runFiscalCaptureE2EFlow(input: {
  evidence: FiscalHomologE2EEvidence;
  pool: pg.Pool;
  automacaoTenantId: string;
  portalClienteId: string;
  gateway: ReceitaFiscalGateway;
  tipoGuia: TipoGuia;
  competencia: string;
  idempotencyKey: string;
  correlationId: string;
  assertionPrefix: string;
  codigoReceita?: string;
  periodoApuracao?: string;
  whatsappMinSentCount?: number;
}): Promise<GuiaRow> {
  const inboxPayload: Record<string, unknown> = {
    event_type: "fiscal.capture.requested",
    portal_cliente_id: input.portalClienteId,
    tipo_guia: input.tipoGuia,
    competencia: input.competencia,
    idempotency_key: input.idempotencyKey,
    correlation_id: input.correlationId
  };

  if (input.tipoGuia === "DARF") {
    inboxPayload.codigo_receita = input.codigoReceita ?? "0561";
    inboxPayload.periodo_apuracao =
      input.periodoApuracao ?? periodoApuracaoFromCompetencia(input.competencia);
  }

  await withTenantTransaction(DEMO_PUBLIC_TENANT_UUID, async (c) => {
    const ins = await insertWebhookInbox(c, {
      source: "n8n",
      externalEventId: input.idempotencyKey,
      payload: inboxPayload,
      correlationId: input.correlationId
    });
    input.evidence.steps[`${input.assertionPrefix}webhookInboxInsert`] = ins;
  });

  const procInbox = await processPendingWebhooksForTenant(DEMO_PUBLIC_TENANT_UUID, 10);
  input.evidence.steps[`${input.assertionPrefix}webhookProcess`] = procInbox;
  recordFiscalAssertion(
    input.evidence,
    `${input.assertionPrefix}inbox_fiscal_processado`,
    procInbox.updated >= 1,
    `updated=${procInbox.updated}`
  );

  let captureJob: Awaited<ReturnType<typeof handleFiscalCaptureInboxPayload>> & { kind: "queued" };
  await withTenantTransaction(DEMO_PUBLIC_TENANT_UUID, async (c) => {
    const handled = await handleFiscalCaptureInboxPayload(
      DEMO_PUBLIC_TENANT_UUID,
      inboxPayload,
      c
    );
    input.evidence.steps[`${input.assertionPrefix}inboxHandle`] = handled;
    if (handled.kind !== "queued") {
      throw new Error(
        `Inbox fiscal ${input.tipoGuia} esperava queued, obteve ${handled.kind}`
      );
    }
    captureJob = handled;
  });

  await processFiscalCaptureJob(captureJob!.job, {
    receitaGateway: input.gateway,
    enqueueNotification: async () => undefined
  });

  const guiaR = await input.pool.query<GuiaRow>(
    `SELECT id::text, status, tipo_guia, compliance_status, pdf_url, pdf_storage_key, valor_total::text
     FROM fiscal.guia_fiscal
     WHERE tenant_id = $1 AND idempotency_key = $2
     LIMIT 1`,
    [input.automacaoTenantId, input.idempotencyKey]
  );
  const guia = guiaR.rows[0];
  if (!guia) {
    throw new Error(`Guia fiscal ${input.tipoGuia} nao encontrada apos captura.`);
  }

  input.evidence.steps[`${input.assertionPrefix}guia`] = guia;

  recordFiscalAssertion(
    input.evidence,
    `${input.assertionPrefix}guia_disponivel_compliance`,
    guia.status === "DISPONIVEL" &&
      guia.compliance_status === "aprovado" &&
      guia.tipo_guia === input.tipoGuia,
    `tipo=${guia.tipo_guia}; status=${guia.status}; compliance=${guia.compliance_status}`
  );
  recordFiscalAssertion(
    input.evidence,
    `${input.assertionPrefix}pdf_persistido`,
    Boolean(guia.pdf_url?.trim()) && Boolean(guia.pdf_storage_key?.trim()),
    `pdf_url=${guia.pdf_url ?? "null"}`
  );

  const auditR = await input.pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM fiscal.audit_log
     WHERE tenant_id = $1 AND resource_id = $2 AND action = 'guia_disponibilizada'`,
    [input.automacaoTenantId, guia.id]
  );
  recordFiscalAssertion(
    input.evidence,
    `${input.assertionPrefix}audit_guia_disponibilizada`,
    Number(auditR.rows[0]?.n ?? 0) >= 1,
    `count=${auditR.rows[0]?.n ?? 0}`
  );

  await processNotificationSend(
    {
      tenantId: input.automacaoTenantId,
      eventType: "guia.disponivel",
      forceChannel: "whatsapp",
      metadata: {
        guia_id: guia.id,
        portal_cliente_id: input.portalClienteId
      }
    },
    {
      zapiAdapter: {
        sendWhatsApp: async () => ({
          messageId: `mock-zapi-${input.assertionPrefix}${input.correlationId}`
        })
      }
    }
  );

  const commR = await input.pool.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM communication_events
     WHERE tenant_id = $1 AND event_type = 'guia.disponivel' AND status = 'sent'`,
    [input.automacaoTenantId]
  );
  const minSent = input.whatsappMinSentCount ?? 1;
  recordFiscalAssertion(
    input.evidence,
    `${input.assertionPrefix}whatsapp_guia_disponivel`,
    Number(commR.rows[0]?.n ?? 0) >= minSent,
    `communication_events sent=${commR.rows[0]?.n ?? 0}; min=${minSent}`
  );

  return guia;
}

export async function runFiscalHomologE2E(connectionString: string): Promise<FiscalHomologE2EEvidence> {
  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  const receitaUrl = process.env.RECEITA_DAS_CAPTURE_URL?.trim();
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY obrigatoria para E2E fiscal homolog.");
  }
  if (!receitaUrl) {
    throw new Error(
      "RECEITA_DAS_CAPTURE_URL obrigatoria. Homolog local: npm run receita:mock:gateway e http://127.0.0.1:19443"
    );
  }

  process.env.FISCAL_GUIAS_ENABLED = "true";
  process.env.FISCAL_CAPTURE_STUB = "false";
  process.env.ENABLE_BULLMQ_WORKERS = "false";
  process.env.FISCAL_PDF_STORAGE = process.env.FISCAL_PDF_STORAGE?.trim() || "local";
  process.env.FISCAL_PDF_LOCAL_DIR =
    process.env.FISCAL_PDF_LOCAL_DIR?.trim() || "./data/fiscal-homolog-e2e";
  resetObjectStorageCache();

  const correlationId = `fiscal-e2e-${Date.now()}`;
  const runSlot = Date.now();
  const yearDas = 2090 + (runSlot % 9);
  const monthDas = (runSlot % 12) + 1;
  const competenciaDas = `${yearDas}-${String(monthDas).padStart(2, "0")}`;
  const yearDarf = yearDas >= 2098 ? 2089 : yearDas + 1;
  const monthDarf = monthDas === 12 ? 1 : monthDas + 1;
  const competenciaDarf = `${yearDarf}-${String(monthDarf).padStart(2, "0")}`;
  const idempotencyKeyDas = `homolog-e2e-das-${correlationId}`;
  const idempotencyKeyDarf = `homolog-e2e-darf-${correlationId}`;

  const evidence: FiscalHomologE2EEvidence = {
    executedAt: new Date().toISOString(),
    git: {
      branch: gitField("git rev-parse --abbrev-ref HEAD"),
      commit: gitField("git rev-parse HEAD")
    },
    environment: {
      nodeEnv: process.env.NODE_ENV ?? "development",
      databaseUrl: maskDbUrl(connectionString),
      receitaDasCaptureUrl: receitaUrl,
      fiscalCaptureStub: false,
      fiscalPdfStorage: process.env.FISCAL_PDF_STORAGE,
      hasEncryptionKey: true,
      hasWebhookSecret: Boolean(process.env.WEBHOOK_INBOX_SECRET?.trim())
    },
    tenantPublicId: DEMO_PUBLIC_TENANT_UUID,
    automacaoTenantId: "",
    correlationId,
    steps: {},
    assertions: [],
    automatedTestsNote: buildFiscalHomologTestsNote()
  };

  recordFiscalAssertion(
    evidence,
    "ambiente_receita_configurado",
    receitaUrl.length > 8,
    receitaUrl
  );

  const gateway = createReceitaFiscalGateway();
  if (!gateway) {
    throw new Error("createReceitaFiscalGateway retornou null.");
  }

  const seed = await runSeedPortalHappyPath(connectionString);
  evidence.automacaoTenantId = seed.automacaoTenantId;

  const pool = new pg.Pool({ connectionString });
  const client = await pool.connect();
  let portalClienteId = "";
  let clientReleased = false;

  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [DEMO_PUBLIC_TENANT_UUID]);

    const insCliente = await client.query<{ id: string }>(
      `INSERT INTO portal.cliente (
         tenant_id, documento, tipo_documento, nome, email, telefone, opt_in_whatsapp
       )
       VALUES ($1, $2, 'cnpj', $3, $4, $5, true)
       ON CONFLICT (tenant_id, documento) DO UPDATE
         SET telefone = EXCLUDED.telefone, opt_in_whatsapp = true, nome = EXCLUDED.nome
       RETURNING id::text AS id`,
      [
        seed.automacaoTenantId,
        TEST_CNPJ,
        "Empresa Homolog Fiscal E2E",
        `fiscal-e2e+${Date.now()}@local.dev`,
        "5511999998888"
      ]
    );
    portalClienteId = insCliente.rows[0]!.id;
    evidence.steps.portalClienteId = portalClienteId;

    const cert = await insertCertificadoDigital(client, {
      tenantId: seed.automacaoTenantId,
      portalClienteId,
      label: "A1 Homolog E2E",
      validFrom: "2026-01-01",
      validUntil: "2028-12-31",
      certificadoPem: FAKE_CERT,
      chavePrivadaPem: FAKE_KEY
    });
    evidence.steps.certificadoId = cert.id;
    recordFiscalAssertion(evidence, "certificado_cadastrado", Boolean(cert.id), cert.id);

    const proc = await insertProcuracao(client, {
      tenantId: seed.automacaoTenantId,
      portalClienteId,
      tipo: "ecac",
      procuradorDocumento: "12345678901",
      validadeInicio: "2026-01-01",
      validadeFim: "2028-12-31",
      ativa: true
    });
    evidence.steps.procuracaoId = proc.id;
    recordFiscalAssertion(evidence, "procuracao_cadastrada", Boolean(proc.id), proc.id);

    await client.query("COMMIT");
    client.release();
    clientReleased = true;

    const guiaDas = await runFiscalCaptureE2EFlow({
      evidence,
      pool,
      automacaoTenantId: seed.automacaoTenantId,
      portalClienteId,
      gateway,
      tipoGuia: "DAS",
      competencia: competenciaDas,
      idempotencyKey: idempotencyKeyDas,
      correlationId: `${correlationId}-das`,
      assertionPrefix: "das_"
    });
    evidence.steps.guiaDas = guiaDas;

    const periodoApuracaoDarf = periodoApuracaoFromCompetencia(competenciaDarf);
    const guiaDarf = await runFiscalCaptureE2EFlow({
      evidence,
      pool,
      automacaoTenantId: seed.automacaoTenantId,
      portalClienteId,
      gateway,
      tipoGuia: "DARF",
      competencia: competenciaDarf,
      idempotencyKey: idempotencyKeyDarf,
      correlationId: `${correlationId}-darf`,
      assertionPrefix: "darf_",
      codigoReceita: "0561",
      periodoApuracao: periodoApuracaoDarf,
      whatsappMinSentCount: 2
    });
    evidence.steps.guiaDarf = guiaDarf;
    evidence.steps.darfGatewayPath = "/darf/capture";

    return evidence;
  } catch (error: unknown) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* client may already be released */
    }
    throw error;
  } finally {
    if (!clientReleased) {
      client.release();
    }
    await pool.end();
    await closePool();
  }
}
