import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/app";
import {
  runSeedPortalHappyPath,
  SEED_PORTAL_DEFAULT_PASSWORD,
  SEED_PORTAL_EMAIL,
  SEED_AUTOMACAO_SLUG
} from "../../src/dev/seed-portal-happy-path";
import {
  EXEQ_MASTER_EMAIL,
  EXEQ_MASTER_PASSWORD,
  runSeedExeqPlatform
} from "../../src/dev/seed-exeq-platform";
import { ensureOrganizationForEscritorio } from "../../src/modules/exeq-platform/infrastructure/organization-repository";
import { closePool, getPool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const TEST_CNPJ = "11222333000181";

async function assertIntegrationDbReady(): Promise<void> {
  if (!hasDb) return;
  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    const r = await pool.query<{ ok: boolean }>(
      `SELECT to_regclass('portal.organization') IS NOT NULL AS ok`
    );
    if (!r.rows[0]?.ok) {
      throw new Error(
        "Schema portal.organization ausente. Execute: npm run migrate && npm run backfill:organization"
      );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("ECONNREFUSED") || msg.includes("connect")) {
      throw new Error(
        "Postgres indisponivel em DATABASE_URL. Execute: npm run verify:sprint1 (sobe Docker + migrate + testes)"
      );
    }
    throw error;
  }
}

describe.skipIf(!hasDb)("Sprint 1 — organization + SERPRO config", () => {
  let app: ReturnType<typeof createApp>;
  let tenantId = "";
  let organizationId = "";
  let masterToken = "";
  let adminToken = "";
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;
  const previousEnc = process.env.ENCRYPTION_KEY;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY?.trim() || "a".repeat(64);

    await assertIntegrationDbReady();

    app = createApp();
    await runSeedExeqPlatform(process.env.DATABASE_URL!.trim());
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    tenantId = seed.automacaoTenantId;

    const client = await getPool().connect();
    try {
      organizationId = await ensureOrganizationForEscritorio(client, {
        automacaoTenantId: tenantId,
        slug: SEED_AUTOMACAO_SLUG,
        name: "Escritorio Demo"
      });
      await client.query(`DELETE FROM fiscal.serpro_config WHERE organization_id = $1::uuid`, [
        organizationId
      ]);
    } finally {
      client.release();
    }

    masterToken = await exeqMasterLogin(app);
    adminToken = await portalLogin(app, tenantId);
  });

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.FISCAL_GUIAS_ENABLED;
    else process.env.FISCAL_GUIAS_ENABLED = previousFlag;
    if (previousEnc === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previousEnc;
    try {
      await closePool();
    } catch {
      /* pool pode não ter sido aberto */
    }
  });

  it("GET /v1/exeq/organizations exige master token", async (ctx) => {
    if (!app) ctx.skip();
    await request(app).get("/v1/exeq/organizations").expect(401);
  });

  it("master lista organizacoes com vinculo tenant", async (ctx) => {
    if (!masterToken || !organizationId || !tenantId) ctx.skip();

    const res = await request(app)
      .get("/v1/exeq/organizations")
      .set("Authorization", `Bearer ${masterToken}`)
      .expect(200);

    expect(res.body.count).toBeGreaterThan(0);
    const org = (res.body.data as Array<{ id: string; automacao_tenant_id: string | null }>).find(
      (o) => o.id === organizationId
    );
    expect(org).toBeTruthy();
    expect(org!.automacao_tenant_id).toBe(tenantId);
  });

  it("master obtem organizacao por id", async (ctx) => {
    if (!masterToken || !organizationId) ctx.skip();

    const res = await request(app)
      .get(`/v1/exeq/organizations/${organizationId}`)
      .set("Authorization", `Bearer ${masterToken}`)
      .expect(200);

    expect(res.body.organization.id).toBe(organizationId);
    expect(res.body.organization.type).toBe("escritorio");
  });

  it("admin GET serpro-config retorna defaults antes do cadastro", async (ctx) => {
    if (!adminToken || !organizationId) ctx.skip();

    const res = await request(app)
      .get("/v1/portal/fiscal/serpro-config")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(res.body.serpro_config.organization_id).toBe(organizationId);
    expect(res.body.serpro_config.serpro_enabled).toBe(false);
    expect(res.body.serpro_config.consumer_key_configured).toBe(false);
  });

  it("admin PATCH serpro-config persiste credenciais cifradas", async (ctx) => {
    if (!adminToken || !organizationId) ctx.skip();

    const patch = await request(app)
      .patch("/v1/portal/fiscal/serpro-config")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .send({
        ambiente: "demo",
        contratante_cnpj: TEST_CNPJ,
        consumer_key: "consumer-key-homolog-test",
        consumer_secret: "consumer-secret-homolog-test",
        serpro_enabled: true
      })
      .expect(200);

    expect(patch.body.serpro_config.serpro_enabled).toBe(true);
    expect(patch.body.serpro_config.consumer_key_configured).toBe(true);
    expect(patch.body.serpro_config.consumer_secret_configured).toBe(true);
    expect(patch.body.serpro_config.contratante_cnpj).toMatch(/^\d{2}\.\*\*\*/);

    const get = await request(app)
      .get("/v1/portal/fiscal/serpro-config")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(get.body.serpro_config.serpro_enabled).toBe(true);
    expect(get.body.serpro_config.consumer_key_configured).toBe(true);

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    try {
      const row = await client.query<{ key: string | null; secret: string | null }>(
        `SELECT consumer_key_encrypted AS key, consumer_secret_encrypted AS secret
         FROM fiscal.serpro_config WHERE organization_id = $1::uuid`,
        [organizationId]
      );
      expect(row.rows[0]?.key).toBeTruthy();
      expect(row.rows[0]?.secret).toBeTruthy();
      expect(row.rows[0]?.key).not.toBe("consumer-key-homolog-test");
    } finally {
      await client.end();
    }
  });

  it("operador nao altera serpro-config", async (ctx) => {
    if (!tenantId) ctx.skip();

    const operadorToken = await portalLoginAsOperador(app, tenantId);
    if (!operadorToken) ctx.skip();

    await request(app)
      .patch("/v1/portal/fiscal/serpro-config")
      .set("Authorization", `Bearer ${operadorToken}`)
      .set("x-tenant-id", tenantId)
      .send({
        contratante_cnpj: TEST_CNPJ,
        serpro_enabled: false
      })
      .expect(403);
  });
});

async function exeqMasterLogin(app: ReturnType<typeof createApp>): Promise<string> {
  const r = await request(app)
    .post("/v1/exeq/auth/login")
    .send({ email: EXEQ_MASTER_EMAIL, password: EXEQ_MASTER_PASSWORD })
    .expect(200);
  return r.body.access_token as string;
}

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

async function portalLoginAsOperador(
  app: ReturnType<typeof createApp>,
  automacaoTenantId: string
): Promise<string | null> {
  const operadorEmail = "operador-serpro-s1@local.dev";
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
  await client.connect();
  try {
    const { hashPortalPassword } = await import(
      "../../src/modules/portal-read/application/portal-password"
    );
    const hash = await hashPortalPassword(SEED_PORTAL_DEFAULT_PASSWORD);
    const user = await client.query<{ id: string }>(
      `INSERT INTO portal.app_user (email, full_name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
       RETURNING id::text AS id`,
      [operadorEmail, "Operador SERPRO S1", hash]
    );
    const userId = user.rows[0]?.id;
    if (!userId) return null;

    await client.query(
      `INSERT INTO portal.membership (app_user_id, tenant_id, role)
       VALUES ($1::uuid, $2, 'operador')
       ON CONFLICT DO NOTHING`,
      [userId, automacaoTenantId]
    );
  } finally {
    await client.end();
  }

  const r = await request(app)
    .post("/v1/portal/auth/login")
    .send({
      email: operadorEmail,
      tenant_id: automacaoTenantId,
      password: SEED_PORTAL_DEFAULT_PASSWORD
    });
  if (r.status !== 200) return null;
  return r.body.access_token as string;
}
