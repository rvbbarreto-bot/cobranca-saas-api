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
import { closePool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const TEST_CNPJ = "99887766554433";
const LINHA = "34191790010104351004791020150008884410026000";

describe.skipIf(!hasDb)("Fiscal — conciliação bancária guia (inbox)", () => {
  let app: ReturnType<typeof createApp>;
  let automacaoTenantId = "";
  let portalClienteId = "";
  let guiaId = "";
  let token = "";
  const idemBase = `reconciliation-${Date.now()}`;
  const webhookSecret = process.env.WEBHOOK_INBOX_SECRET?.trim();
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";

    app = createApp();
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    automacaoTenantId = seed.automacaoTenantId;

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    try {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email, telefone, opt_in_whatsapp)
         VALUES ($1, $2, 'cnpj', $3, $4, $5, true)
         ON CONFLICT (tenant_id, documento) DO UPDATE
           SET nome = EXCLUDED.nome, telefone = EXCLUDED.telefone, opt_in_whatsapp = true
         RETURNING id::text AS id`,
        [automacaoTenantId, TEST_CNPJ, "Empresa Conciliacao Fiscal", "conciliacao@local.dev", "11999998888"]
      );
      portalClienteId = ins.rows[0]!.id;

      const guia = await client.query<{ id: string }>(
        `INSERT INTO fiscal.guia_fiscal (
           tenant_id, portal_cliente_id, tipo_guia, competencia,
           valor_principal, idempotency_key, status, compliance_status,
           linha_digitavel
         )
         VALUES ($1, $2::uuid, 'DARF', '2032-01', 250.00, $3, 'DISPONIVEL', 'aprovado', $4)
         ON CONFLICT (tenant_id, idempotency_key) DO UPDATE
           SET status = 'DISPONIVEL',
               linha_digitavel = EXCLUDED.linha_digitavel,
               updated_at = now()
         RETURNING id::text AS id`,
        [automacaoTenantId, portalClienteId, `${idemBase}-guia`, LINHA]
      );
      guiaId = guia.rows[0]!.id;
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
    await closePool();
  });

  it("inbox concilia por linha_digitavel e marca guia PAGO", async () => {
    const idem = `${idemBase}-linha`;
    const req = request(app)
      .post("/v1/inbox/webhooks")
      .set("x-tenant-id", "demo")
      .set("X-External-Event-Id", idem);
    if (webhookSecret) {
      req.set("x-webhook-secret", webhookSecret);
    }
    await req
      .send({
        event_type: "fiscal.guia.reconciliation.requested",
        idempotency_key: idem,
        valor_pago: 250,
        data_pagamento: "2032-01-20",
        linha_digitavel: LINHA,
        referencia_externa: "bank-tx-001"
      })
      .expect(202);

    const processed = await processPendingWebhooksForTenant(DEMO_PUBLIC_TENANT_UUID, 10);
    expect(processed.updated).toBeGreaterThanOrEqual(1);

    const detail = await request(app)
      .get(`/v1/portal/fiscal/guias/${guiaId}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", automacaoTenantId)
      .expect(200);

    expect(detail.body.guia.status).toBe("PAGO");

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    try {
      const pag = await client.query<{ meio: string }>(
        `SELECT meio FROM fiscal.guia_pagamento
         WHERE guia_fiscal_id = $1::uuid AND metadata->>'reconciliation_idempotency_key' = $2`,
        [guiaId, idem]
      );
      expect(pag.rows[0]?.meio).toBe("conciliacao");
    } finally {
      await client.end();
    }
  });

  it("reprocessamento idempotente nao duplica pagamento", async () => {
    const idem = `${idemBase}-linha`;
    const processed = await processPendingWebhooksForTenant(DEMO_PUBLIC_TENANT_UUID, 10);
    expect(processed.skipped_already_processed).toBeGreaterThanOrEqual(0);

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    try {
      const count = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n
         FROM fiscal.guia_pagamento
         WHERE guia_fiscal_id = $1::uuid AND metadata->>'reconciliation_idempotency_key' = $2`,
        [guiaId, idem]
      );
      expect(Number(count.rows[0]?.n)).toBe(1);
    } finally {
      await client.end();
    }
  });
});
