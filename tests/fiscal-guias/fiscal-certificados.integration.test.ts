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
const TEST_CNPJ = "99888777000166";

const FAKE_CERT =
  "-----BEGIN CERTIFICATE-----\n" + "A".repeat(120) + "\n-----END CERTIFICATE-----";
const FAKE_KEY =
  "-----BEGIN PRIVATE KEY-----\n" + "B".repeat(120) + "\n-----END PRIVATE KEY-----";

async function fiscalSchemaReady(): Promise<boolean> {
  const pool = getPool();
  const r = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('fiscal.certificado_digital') IS NOT NULL AS ok`
  );
  return Boolean(r.rows[0]?.ok);
}

describe.skipIf(!hasDb)("Fiscal — POST certificados / procuracoes (cross-tenant)", () => {
  let app: ReturnType<typeof createApp>;
  let tenantA = "";
  let tenantB = "";
  let tokenA = "";
  let tokenB = "";
  let portalClienteIdA = "";
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;
  const previousEnc = process.env.ENCRYPTION_KEY;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY?.trim() || "a".repeat(64);

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

      const ins = await client.query<{ id: string }>(
        `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email)
         VALUES ($1, $2, 'cnpj', $3, $4)
         ON CONFLICT (tenant_id, documento) DO UPDATE SET nome = EXCLUDED.nome
         RETURNING id::text AS id`,
        [tenantA, TEST_CNPJ, "Empresa Cert Fiscal", "cert-fiscal@local.dev"]
      );
      portalClienteIdA = ins.rows[0]!.id;
    } finally {
      await client.end();
    }

    tokenA = await portalLogin(app, tenantA);
    tokenB = await portalLogin(app, tenantB);
  });

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.FISCAL_GUIAS_ENABLED;
    else process.env.FISCAL_GUIAS_ENABLED = previousFlag;
    if (previousEnc === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previousEnc;
    await closePool();
  });

  it("admin cadastra certificado digital para cliente do tenant", async (ctx) => {
    if (!tokenA || !portalClienteIdA) ctx.skip();

    const res = await request(app)
      .post("/v1/portal/fiscal/certificados")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .send({
        portal_cliente_id: portalClienteIdA,
        label: "A1 Homolog",
        valid_from: "2026-01-01",
        valid_until: "2027-01-01",
        certificado_pem: FAKE_CERT,
        chave_privada_pem: FAKE_KEY
      })
      .expect(201);

    expect(res.body.certificado.portal_cliente_id).toBe(portalClienteIdA);
    expect(res.body.certificado.ativo).toBe(true);
  });

  it("tenant B nao cadastra certificado para cliente do tenant A", async (ctx) => {
    if (!tokenB || !portalClienteIdA || !tenantB) ctx.skip();

    await request(app)
      .post("/v1/portal/fiscal/certificados")
      .set("Authorization", `Bearer ${tokenB}`)
      .set("x-tenant-id", tenantB)
      .send({
        portal_cliente_id: portalClienteIdA,
        label: "A1 Cross",
        valid_from: "2026-01-01",
        valid_until: "2027-01-01",
        certificado_pem: FAKE_CERT,
        chave_privada_pem: FAKE_KEY
      })
      .expect(404);
  });

  it("admin cadastra procuracao", async (ctx) => {
    if (!tokenA || !portalClienteIdA) ctx.skip();

    const res = await request(app)
      .post("/v1/portal/fiscal/procuracoes")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .send({
        portal_cliente_id: portalClienteIdA,
        tipo: "ecac",
        procurador_documento: "12345678901",
        validade_inicio: "2026-01-01",
        validade_fim: "2027-01-01"
      })
      .expect(201);

    expect(res.body.procuracao.tipo).toBe("ecac");
  });

  it("GET certificado retorna cadastro persistido", async (ctx) => {
    if (!tokenA || !portalClienteIdA) ctx.skip();

    const res = await request(app)
      .get("/v1/portal/fiscal/certificados")
      .query({ portal_cliente_id: portalClienteIdA })
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .expect(200);

    expect(res.body.certificado).toBeTruthy();
    expect(res.body.certificado.portal_cliente_id).toBe(portalClienteIdA);
    expect(res.body.certificado.label).toBe("A1 Homolog");
    expect(res.body.certificado).not.toHaveProperty("certificado_pem");
  });

  it("GET procuracao retorna cadastro persistido", async (ctx) => {
    if (!tokenA || !portalClienteIdA) ctx.skip();

    const res = await request(app)
      .get("/v1/portal/fiscal/procuracoes")
      .query({ portal_cliente_id: portalClienteIdA })
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .expect(200);

    expect(res.body.procuracao).toBeTruthy();
    expect(res.body.procuracao.tipo).toBe("ecac");
    expect(res.body.procuracao.procurador_documento).toBe("12345678901");
  });

  it("GET certificado retorna null para cliente sem cadastro", async (ctx) => {
    if (!tokenA || !tenantA) ctx.skip();

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    let emptyClienteId = "";
    try {
      const ins = await client.query<{ id: string }>(
        `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email)
         VALUES ($1, $2, 'cnpj', $3, $4)
         RETURNING id::text AS id`,
        [tenantA, "77665544000199", "Sem Cert Fiscal", "sem-cert@local.dev"]
      );
      emptyClienteId = ins.rows[0]!.id;
    } finally {
      await client.end();
    }

    const res = await request(app)
      .get("/v1/portal/fiscal/certificados")
      .query({ portal_cliente_id: emptyClienteId })
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .expect(200);

    expect(res.body.certificado).toBeNull();
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
  const slug = "escritorio-fiscal-cert-test";
  const existing = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM automacao.tenants WHERE lower(trim(slug)) = lower(trim($1)) LIMIT 1`,
    [slug]
  );
  if (existing.rows[0]?.id) return existing.rows[0].id;

  const ins = await client.query<{ id: string }>(
    `INSERT INTO automacao.tenants (slug, nome, ativo) VALUES ($1, $2, true) RETURNING id::text AS id`,
    [slug, "Escritorio fiscal cert test"]
  );
  return ins.rows[0]!.id;
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
  if (!userId) throw new Error("Usuario seed portal ausente.");

  await client.query(
    `INSERT INTO portal.membership (app_user_id, tenant_id, role)
     VALUES ($1::uuid, $2, 'admin_escritorio') ON CONFLICT DO NOTHING`,
    [userId, tenantA]
  );
  await client.query(
    `INSERT INTO portal.membership (app_user_id, tenant_id, role)
     VALUES ($1::uuid, $2, 'admin_escritorio') ON CONFLICT DO NOTHING`,
    [userId, tenantB]
  );
}
