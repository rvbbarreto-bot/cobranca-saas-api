import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/app";
import {
  runSeedPortalHappyPath,
  SEED_PORTAL_DEFAULT_PASSWORD,
  SEED_PORTAL_EMAIL
} from "../../src/dev/seed-portal-happy-path";
import { closePool, getPool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const TEST_CNPJ = "55443322110055";

async function fiscalSchemaReady(): Promise<boolean> {
  const pool = getPool();
  const r = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('fiscal.guia_pagamento') IS NOT NULL AS ok`
  );
  return Boolean(r.rows[0]?.ok);
}

describe.skipIf(!hasDb)("Fiscal — PDF URL e pagamento guia (cross-tenant)", () => {
  let app: ReturnType<typeof createApp>;
  let tenantA = "";
  let tenantB = "";
  let tokenA = "";
  let tokenB = "";
  let guiaIdA = "";
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;
  const previousStorage = process.env.FISCAL_PDF_STORAGE;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.FISCAL_PDF_STORAGE = "local";

    if (!(await fiscalSchemaReady())) {
      return;
    }

    app = createApp();
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    tenantA = seed.automacaoTenantId;

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    try {
      tenantB = await ensureAutomacaoTenantB(client);
      await ensureMembershipTenantB(client, tenantA, tenantB);

      const portalClienteId = await insertPortalCliente(client, tenantA);
      guiaIdA = await insertGuiaFiscalDisponivel(client, tenantA, portalClienteId);
    } finally {
      await client.end();
    }

    tokenA = await portalLogin(app, tenantA);
    tokenB = await portalLogin(app, tenantB);
  });

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.FISCAL_GUIAS_ENABLED;
    else process.env.FISCAL_GUIAS_ENABLED = previousFlag;
    if (previousStorage === undefined) delete process.env.FISCAL_PDF_STORAGE;
    else process.env.FISCAL_PDF_STORAGE = previousStorage;
    await closePool();
  });

  it("staff obtem URL assinada do PDF da guia", async (ctx) => {
    if (!tokenA || !guiaIdA) ctx.skip();

    const res = await request(app)
      .get(`/v1/portal/fiscal/guias/${guiaIdA}/pdf-url`)
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .expect(200);

    expect(res.body.pdf_url).toMatch(/^(https?|file):\/\//);
    expect(res.body.expires_in_seconds).toBeGreaterThan(0);
  });

  it("admin registra pagamento e guia fica PAGO", async (ctx) => {
    if (!tokenA || !guiaIdA) ctx.skip();

    const res = await request(app)
      .post(`/v1/portal/fiscal/guias/${guiaIdA}/pagamentos`)
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .send({
        valor_pago: 250,
        data_pagamento: "2026-05-20",
        meio: "pix"
      })
      .expect(201);

    expect(res.body.guia_status).toBe("PAGO");
    expect(res.body.pagamento.valor_pago).toBe(250);

    const detail = await request(app)
      .get(`/v1/portal/fiscal/guias/${guiaIdA}`)
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .expect(200);

    expect(detail.body.guia.status).toBe("PAGO");
  });

  it("tenant B nao obtem PDF da guia do tenant A", async (ctx) => {
    if (!tokenB || !guiaIdA || !tenantB) ctx.skip();

    await request(app)
      .get(`/v1/portal/fiscal/guias/${guiaIdA}/pdf-url`)
      .set("Authorization", `Bearer ${tokenB}`)
      .set("x-tenant-id", tenantB)
      .expect(404);
  });

  it("tenant B nao registra pagamento na guia do tenant A", async (ctx) => {
    if (!tokenB || !guiaIdA || !tenantB) ctx.skip();

    await request(app)
      .post(`/v1/portal/fiscal/guias/${guiaIdA}/pagamentos`)
      .set("Authorization", `Bearer ${tokenB}`)
      .set("x-tenant-id", tenantB)
      .send({
        valor_pago: 250,
        data_pagamento: "2026-05-20"
      })
      .expect(404);
  });
});

async function portalLogin(
  app: ReturnType<typeof createApp>,
  automacaoTenantId: string
): Promise<string> {
  const r = await request(app)
    .post("/v1/portal/auth/login")
    .send({
      email: SEED_PORTAL_EMAIL,
      tenant_id: automacaoTenantId,
      password: SEED_PORTAL_DEFAULT_PASSWORD
    })
    .expect(200);
  return r.body.access_token as string;
}

async function ensureAutomacaoTenantB(client: pg.Client): Promise<string> {
  const slug = "escritorio-fiscal-pagamento-test";
  const existing = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM automacao.tenants WHERE lower(trim(slug)) = lower(trim($1)) LIMIT 1`,
    [slug]
  );
  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const ins = await client.query<{ id: string }>(
    `INSERT INTO automacao.tenants (slug, nome, ativo)
     VALUES ($1, $2, true)
     RETURNING id::text AS id`,
    [slug, "Escritorio fiscal pagamento test"]
  );
  const id = ins.rows[0]?.id;
  if (!id) {
    throw new Error("Falha ao criar automacao tenant B.");
  }
  return id;
}

async function ensureMembershipTenantB(
  client: pg.Client,
  tenantA: string,
  tenantB: string
): Promise<void> {
  const user = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM portal.app_user WHERE lower(email) = lower($1) LIMIT 1`,
    [SEED_PORTAL_EMAIL]
  );
  const userId = user.rows[0]?.id;
  if (!userId) {
    throw new Error("Usuario seed portal ausente.");
  }

  await client.query(
    `INSERT INTO portal.membership (app_user_id, tenant_id, role)
     VALUES ($1::uuid, $2, 'admin_escritorio')
     ON CONFLICT DO NOTHING`,
    [userId, tenantA]
  );

  await client.query(
    `INSERT INTO portal.membership (app_user_id, tenant_id, role)
     VALUES ($1::uuid, $2, 'admin_escritorio')
     ON CONFLICT DO NOTHING`,
    [userId, tenantB]
  );
}

async function insertPortalCliente(client: pg.Client, tenantId: string): Promise<string> {
  const ins = await client.query<{ id: string }>(
    `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email)
     VALUES ($1, $2, 'cnpj', $3, $4)
     ON CONFLICT (tenant_id, documento) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id::text AS id`,
    [tenantId, TEST_CNPJ, "Empresa Pagamento Fiscal", "pagamento-fiscal@local.dev"]
  );
  const id = ins.rows[0]?.id;
  if (!id) {
    throw new Error("Falha ao inserir portal.cliente.");
  }
  return id;
}

async function insertGuiaFiscalDisponivel(
  client: pg.Client,
  tenantId: string,
  portalClienteId: string
): Promise<string> {
  const idem = `pagamento-fiscal-${tenantId.slice(0, 8)}-2026-05`;
  const ins = await client.query<{ id: string }>(
    `INSERT INTO fiscal.guia_fiscal (
       tenant_id, portal_cliente_id, tipo_guia, competencia,
       valor_principal, idempotency_key, status, compliance_status,
       pdf_storage_key
     )
     VALUES ($1, $2::uuid, 'DAS', '2026-05', 250.00, $3, 'DISPONIVEL', 'aprovado', $4)
     ON CONFLICT (tenant_id, idempotency_key) DO UPDATE
       SET status = 'DISPONIVEL',
           pdf_storage_key = EXCLUDED.pdf_storage_key,
           updated_at = now()
     RETURNING id::text AS id`,
    [tenantId, portalClienteId, idem, `fiscal/test/${tenantId}/guia-test.pdf`]
  );
  const id = ins.rows[0]?.id;
  if (!id) {
    throw new Error("Falha ao inserir fiscal.guia_fiscal.");
  }
  return id;
}
