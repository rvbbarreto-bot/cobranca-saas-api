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

async function fiscalAuditReady(): Promise<boolean> {
  const pool = getPool();
  const r = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('fiscal.audit_log') IS NOT NULL AS ok`
  );
  return Boolean(r.rows[0]?.ok);
}

describe.skipIf(!hasDb)("Fiscal — GET /v1/portal/fiscal/audit (EXEQ-FISC-080)", () => {
  let app: ReturnType<typeof createApp>;
  let tenantId = "";
  let adminToken = "";
  let operadorToken = "";
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    if (!(await fiscalAuditReady())) {
      return;
    }

    app = createApp();
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    tenantId = seed.automacaoTenantId;

    const login = await request(app)
      .post("/v1/portal/auth/login")
      .send({
        email: SEED_PORTAL_EMAIL,
        tenant_id: tenantId,
        password: SEED_PORTAL_DEFAULT_PASSWORD
      });
    adminToken = login.body.access_token as string;

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    try {
      await client.query(
        `INSERT INTO fiscal.audit_log (tenant_id, user_id, action, resource_type, resource_id, new_value)
         VALUES ($1, $2, 'download_pdf', 'guia_fiscal', $3, '{"source":"test"}'::jsonb)`,
        [tenantId, "seed-admin-user", "audit-guia-1"]
      );
      await client.query(
        `INSERT INTO fiscal.audit_log (tenant_id, user_id, action, resource_type, resource_id)
         VALUES ($1, $2, 'upload_certificado', 'certificado_digital', 'cert-1')`,
        [tenantId, "seed-admin-user"]
      );
    } finally {
      await client.end();
    }

    const operadorLogin = await request(app)
      .post("/v1/portal/auth/login")
      .send({
        email: "operador@teste.local",
        tenant_id: tenantId,
        password: SEED_PORTAL_DEFAULT_PASSWORD
      });
    if (operadorLogin.status === 200) {
      operadorToken = operadorLogin.body.access_token as string;
    }
  });

  afterAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = previousFlag;
    await closePool();
  });

  it("admin lista auditoria paginada", async (ctx) => {
    if (!adminToken || !tenantId) ctx.skip();

    const res = await request(app)
      .get("/v1/portal/fiscal/audit?limit=10")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(Array.isArray(res.body.entries)).toBe(true);
    expect(res.body.entries.length).toBeGreaterThanOrEqual(1);
    expect(res.body.entries[0]).toMatchObject({
      action: expect.any(String),
      resource_type: expect.any(String),
      resource_id: expect.any(String)
    });
  });

  it("filtra por action", async (ctx) => {
    if (!adminToken || !tenantId) ctx.skip();

    const res = await request(app)
      .get("/v1/portal/fiscal/audit?action=upload_certificado&limit=20")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(res.body.entries.every((e: { action: string }) => e.action === "upload_certificado")).toBe(true);
  });

  it("operador recebe 403", async (ctx) => {
    if (!operadorToken || !tenantId) ctx.skip();

    await request(app)
      .get("/v1/portal/fiscal/audit")
      .set("Authorization", `Bearer ${operadorToken}`)
      .set("x-tenant-id", tenantId)
      .expect(403);
  });
});
