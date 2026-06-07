import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/app";
import {
  DEMO_PUBLIC_TENANT_UUID,
  runSeedPortalHappyPath,
  SEED_PORTAL_DEFAULT_PASSWORD,
  SEED_PORTAL_EMAIL
} from "../../src/dev/seed-portal-happy-path";
import { processPendingWebhooksForTenant } from "../../src/modules/inbox/application/process-webhook-inbox";
import { processFiscalCaptureJob } from "../../src/platform/jobs/application/fiscal-capture-processor";
import { closePool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const TEST_CNPJ = "11222333000181";

describe.skipIf(!hasDb)("Fiscal — inbox capture → guia persistida", () => {
  let app: ReturnType<typeof createApp>;
  let automacaoTenantId = "";
  let portalClienteId = "";
  let token = "";
  const idem = `inbox-fiscal-${Date.now()}`;
  const competencia = `2031-${String((Date.now() % 12) + 1).padStart(2, "0")}`;
  const webhookSecret = process.env.WEBHOOK_INBOX_SECRET?.trim();
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;
  const previousStub = process.env.FISCAL_CAPTURE_STUB;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.FISCAL_CAPTURE_STUB = "true";

    app = createApp();
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    automacaoTenantId = seed.automacaoTenantId;

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    try {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email)
         VALUES ($1, $2, 'cnpj', $3, $4)
         ON CONFLICT (tenant_id, documento) DO UPDATE SET nome = EXCLUDED.nome
         RETURNING id::text AS id`,
        [automacaoTenantId, TEST_CNPJ, "Empresa Inbox Fiscal", "inbox-fiscal@local.dev"]
      );
      portalClienteId = ins.rows[0]!.id;
    } finally {
      await client.end();
    }

    const login = await request(app)
      .post("/v1/portal/auth/login")
      .send({
        email: SEED_PORTAL_EMAIL,
        tenant_id: automacaoTenantId,
        password: SEED_PORTAL_DEFAULT_PASSWORD
      });
    token = login.body.access_token as string;
  });

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.FISCAL_GUIAS_ENABLED;
    else process.env.FISCAL_GUIAS_ENABLED = previousFlag;
    if (previousStub === undefined) delete process.env.FISCAL_CAPTURE_STUB;
    else process.env.FISCAL_CAPTURE_STUB = previousStub;
    await closePool();
  });

  it("inbox fiscal enfileira e worker grava guia DISPONIVEL (stub)", async () => {
    const req = request(app)
      .post("/v1/inbox/webhooks")
      .set("x-tenant-id", "demo")
      .set("X-External-Event-Id", idem);
    if (webhookSecret) {
      req.set("x-webhook-secret", webhookSecret);
    }
    await req
      .send({
        event_type: "fiscal.capture.requested",
        portal_cliente_id: portalClienteId,
        tipo_guia: "DAS",
        competencia,
        idempotency_key: idem
      })
      .expect(202);

    const processed = await processPendingWebhooksForTenant(DEMO_PUBLIC_TENANT_UUID, 10);
    expect(processed.updated).toBeGreaterThanOrEqual(1);

    await processFiscalCaptureJob(
      {
        publicTenantUuid: DEMO_PUBLIC_TENANT_UUID,
        automacaoTenantId,
        portalClienteId,
        tipoGuia: "DAS",
        competencia,
        idempotencyKey: idem
      },
      { enqueueNotification: async () => undefined }
    );

    const list = await request(app)
      .get(`/v1/portal/fiscal/guias?competencia=${competencia}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", automacaoTenantId)
      .expect(200);

    const guias = list.body.guias as { id: string; status: string; competencia: string }[];
    expect(guias.some((g) => g.competencia === competencia && g.status === "DISPONIVEL")).toBe(true);

    const guiaId = guias.find((g) => g.competencia === competencia)!.id;
    const detail = await request(app)
      .get(`/v1/portal/fiscal/guias/${guiaId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", automacaoTenantId)
      .expect(200);

    expect(detail.body.guia.status).toBe("DISPONIVEL");
    expect(detail.body.guia.compliance_status).toBe("aprovado");
  });

  it("inbox DARF enfileira e worker grava guia DARF DISPONIVEL (stub)", async () => {
    const idemDarf = `inbox-fiscal-darf-${Date.now()}`;
    const competenciaDarf = `2032-${String((Date.now() % 12) + 1).padStart(2, "0")}`;
    const periodoApuracao = `${competenciaDarf}-28`;

    const req = request(app)
      .post("/v1/inbox/webhooks")
      .set("x-tenant-id", "demo")
      .set("X-External-Event-Id", idemDarf);
    if (webhookSecret) {
      req.set("x-webhook-secret", webhookSecret);
    }
    await req
      .send({
        event_type: "fiscal.capture.requested",
        portal_cliente_id: portalClienteId,
        tipo_guia: "DARF",
        competencia: competenciaDarf,
        codigo_receita: "0561",
        periodo_apuracao: periodoApuracao,
        idempotency_key: idemDarf
      })
      .expect(202);

    const processed = await processPendingWebhooksForTenant(DEMO_PUBLIC_TENANT_UUID, 10);
    expect(processed.updated).toBeGreaterThanOrEqual(1);

    await processFiscalCaptureJob(
      {
        publicTenantUuid: DEMO_PUBLIC_TENANT_UUID,
        automacaoTenantId,
        portalClienteId,
        tipoGuia: "DARF",
        competencia: competenciaDarf,
        codigoReceita: "0561",
        periodoApuracao,
        idempotencyKey: idemDarf
      },
      { enqueueNotification: async () => undefined }
    );

    const list = await request(app)
      .get(`/v1/portal/fiscal/guias?competencia=${competenciaDarf}&tipo_guia=DARF`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", automacaoTenantId)
      .expect(200);

    const guias = list.body.guias as { id: string; status: string; tipo_guia: string; competencia: string }[];
    const guia = guias.find((g) => g.competencia === competenciaDarf && g.tipo_guia === "DARF");
    expect(guia?.status).toBe("DISPONIVEL");

    const detail = await request(app)
      .get(`/v1/portal/fiscal/guias/${guia!.id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", automacaoTenantId)
      .expect(200);

    expect(detail.body.guia.tipo_guia).toBe("DARF");
    expect(detail.body.guia.status).toBe("DISPONIVEL");
  });
});
