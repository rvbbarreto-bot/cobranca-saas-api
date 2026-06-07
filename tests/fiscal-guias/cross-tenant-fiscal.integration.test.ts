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
const OTHER_PUBLIC_TENANT_UUID = "00000000-0000-4000-8000-000000000002";
const TEST_CNPJ = "11222333000181";

async function fiscalSchemaReady(): Promise<boolean> {
  const pool = getPool();
  const r = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('fiscal.guia_fiscal') IS NOT NULL AS ok`
  );
  return Boolean(r.rows[0]?.ok);
}

describe.skipIf(!hasDb)("Fiscal guias — isolamento cross-tenant (portal)", () => {
  let app: ReturnType<typeof createApp>;
  let tenantA = "";
  let tenantB = "";
  let tokenA = "";
  let tokenB = "";
  let guiaIdA = "";
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";

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
      await ensureBillingLinkTenantB(client, tenantB);

      const clienteId = await insertPortalCliente(client, tenantA);
      guiaIdA = await insertGuiaFiscal(client, tenantA, clienteId);
    } finally {
      await client.end();
    }

    tokenA = await portalLogin(app, tenantA);
    tokenB = await portalLogin(app, tenantB);
  });

  afterAll(async () => {
    if (previousFlag === undefined) {
      delete process.env.FISCAL_GUIAS_ENABLED;
    } else {
      process.env.FISCAL_GUIAS_ENABLED = previousFlag;
    }
    await closePool();
  });

  it("tenant A ve apenas guias do proprio escritorio", async (ctx) => {
    if (!guiaIdA || !tokenA) {
      ctx.skip();
    }

    const res = await request(app)
      .get("/v1/portal/fiscal/guias")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .expect(200);

    const ids = (res.body.guias as { id: string }[]).map((g) => g.id);
    expect(ids).toContain(guiaIdA);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });

  it("tenant B nao ve guia cadastrada no tenant A", async (ctx) => {
    if (!guiaIdA || !tokenB || !tenantB) {
      ctx.skip();
    }

    const res = await request(app)
      .get("/v1/portal/fiscal/guias")
      .set("Authorization", `Bearer ${tokenB}`)
      .set("x-tenant-id", tenantB)
      .expect(200);

    const ids = (res.body.guias as { id: string }[]).map((g) => g.id);
    expect(ids).not.toContain(guiaIdA);
  });

  it("JWT do tenant A com x-tenant-id do tenant B retorna 403", async (ctx) => {
    if (!tokenA || !tenantB) {
      ctx.skip();
    }

    await request(app)
      .get("/v1/portal/fiscal/guias")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantB)
      .expect(403);
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
  const slug = "escritorio-fiscal-cross-test";
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
    [slug, "Escritorio fiscal cross-test"]
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

async function ensureBillingLinkTenantB(client: pg.Client, tenantB: string): Promise<void> {
  await client.query(
    `INSERT INTO portal.billing_tenant_link (automacao_tenant_id, public_tenant_id)
     VALUES ($1, $2::uuid)
     ON CONFLICT (automacao_tenant_id) DO UPDATE
       SET public_tenant_id = EXCLUDED.public_tenant_id`,
    [tenantB, OTHER_PUBLIC_TENANT_UUID]
  );
}

async function insertPortalCliente(client: pg.Client, tenantId: string): Promise<string> {
  const ins = await client.query<{ id: string }>(
    `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email)
     VALUES ($1, $2, 'cnpj', $3, $4)
     ON CONFLICT (tenant_id, documento) DO UPDATE
       SET nome = EXCLUDED.nome
     RETURNING id::text AS id`,
    [tenantId, TEST_CNPJ, "Empresa Fiscal Teste LTDA", "fiscal-test@local.dev"]
  );
  const id = ins.rows[0]?.id;
  if (!id) {
    throw new Error("Falha ao inserir portal.cliente.");
  }
  return id;
}

async function insertGuiaFiscal(
  client: pg.Client,
  tenantId: string,
  portalClienteId: string
): Promise<string> {
  const idem = `cross-tenant-fiscal-${tenantId.slice(0, 8)}-2026-04`;
  const ins = await client.query<{ id: string }>(
    `INSERT INTO fiscal.guia_fiscal (
       tenant_id, portal_cliente_id, tipo_guia, competencia,
       valor_principal, idempotency_key, status, compliance_status
     )
     VALUES ($1, $2::uuid, 'DAS', '2026-04', 250.00, $3, 'DISPONIVEL', 'aprovado')
     ON CONFLICT (tenant_id, idempotency_key) DO UPDATE
       SET updated_at = now()
     RETURNING id::text AS id`,
    [tenantId, portalClienteId, idem]
  );
  const id = ins.rows[0]?.id;
  if (!id) {
    throw new Error("Falha ao inserir fiscal.guia_fiscal.");
  }
  return id;
}
