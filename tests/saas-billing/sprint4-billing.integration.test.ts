import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/app";
import { closePool, getPool } from "../../src/platform/persistence/pool";
import {
  DEMO_PUBLIC_TENANT_UUID,
  runSeedPortalHappyPath,
  SEED_PORTAL_EMAIL
} from "../../src/dev/seed-portal-happy-path";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDb)("Sprint 4 — SaaS billing (integracao)", () => {
  const app = createApp();
  let coreToken = "";
  let portalToken = "";
  let automacaoTenantId = "";

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET?.trim() || "sprint4-billing-test-jwt";

    const r = await request(app).post("/v1/auth/token/mock").set("x-tenant-id", "demo");
    expect(r.status).toBe(200);
    coreToken = r.body.access_token as string;

    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    automacaoTenantId = seed.automacaoTenantId;

    const portal = await request(app)
      .post("/v1/portal/auth/token/mock")
      .send({ email: SEED_PORTAL_EMAIL, tenant_id: automacaoTenantId });
    expect(portal.status).toBe(200);
    portalToken = portal.body.access_token as string;
  }, 60_000);

  afterAll(async () => {
    await closePool();
  });

  it("GET /v1/saas/plans retorna catalogo com 3 planos", async () => {
    const res = await request(app)
      .get("/v1/saas/plans")
      .set("Authorization", `Bearer ${coreToken}`)
      .set("x-tenant-id", "demo")
      .expect(200);

    const plans = res.body?.data as Array<{ slug: string }>;
    expect(Array.isArray(plans)).toBe(true);
    expect(plans.length).toBeGreaterThanOrEqual(3);
    const slugs = plans.map((p) => p.slug).sort();
    expect(slugs).toContain("basico");
    expect(slugs).toContain("profissional");
    expect(slugs).toContain("enterprise");
  });

  it("POST /v1/tenants/provision com plano_slug profissional cria assinatura trial", async () => {
    const slug = `s4-trial-${Date.now()}`;
    const prov = await request(app)
      .post("/v1/tenants/provision")
      .set("Authorization", `Bearer ${coreToken}`)
      .set("x-tenant-id", "demo")
      .send({ slug, name: "Tenant Sprint 4 Trial", status: "trial", plano_slug: "profissional" })
      .expect(201);

    const tenantId = prov.body?.tenant?.id as string;
    expect(tenantId).toBeTruthy();

    const pool = getPool();
    const sub = await pool.query<{
      status: string;
      plan_slug: string;
      trial_ends_at: Date | null;
    }>(
      `SELECT a.status, p.slug AS plan_slug, a.trial_ends_at
       FROM assinaturas a
       INNER JOIN planos p ON p.id = a.plano_id
       WHERE a.tenant_id = $1::uuid`,
      [tenantId]
    );
    expect(sub.rows[0]?.status).toBe("trial");
    expect(sub.rows[0]?.plan_slug).toBe("profissional");
    expect(sub.rows[0]?.trial_ends_at).toBeTruthy();
    const trialEnd = sub.rows[0]!.trial_ends_at!;
    expect(trialEnd.getTime()).toBeGreaterThan(Date.now());
  });

  it("POST /v1/tenants/provision com plano inexistente retorna 400", async () => {
    const slug = `s4-bad-plan-${Date.now()}`;
    const res = await request(app)
      .post("/v1/tenants/provision")
      .set("Authorization", `Bearer ${coreToken}`)
      .set("x-tenant-id", "demo")
      .send({ slug, name: "Plano invalido", status: "trial", plano_slug: "plano-inexistente-xyz" })
      .expect(400);

    expect(res.body?.error).toBe("PLAN_NOT_FOUND");
  });

  it("GET /v1/portal/escritorio/assinatura retorna plano e uso no tenant demo", async () => {
    const res = await request(app)
      .get("/v1/portal/escritorio/assinatura")
      .set("Authorization", `Bearer ${portalToken}`)
      .set("x-tenant-id", automacaoTenantId)
      .expect(200);

    const assinatura = res.body?.assinatura as {
      status: string;
      read_only: boolean;
      plano: { slug: string; max_clientes: number; max_cobrancas_mes: number };
      uso: { year_month: string; clientes: number; cobrancas_criadas_mes: number };
    };
    expect(assinatura).toBeTruthy();
    expect(assinatura.plano?.slug).toBe("profissional");
    expect(typeof assinatura.read_only).toBe("boolean");
    expect(assinatura.uso?.year_month).toMatch(/^\d{4}-\d{2}$/);
    expect(assinatura.uso?.clientes).toBeGreaterThanOrEqual(0);
    expect(assinatura.uso?.cobrancas_criadas_mes).toBeGreaterThanOrEqual(0);
  });

  it("tenant demo tem assinatura trial na migration 023", async () => {
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    try {
      const q = await client.query<{ status: string; slug: string }>(
        `SELECT a.status, p.slug
         FROM assinaturas a
         INNER JOIN planos p ON p.id = a.plano_id
         WHERE a.tenant_id = $1::uuid`,
        [DEMO_PUBLIC_TENANT_UUID]
      );
      expect(q.rows[0]?.status).toBe("trial");
      expect(q.rows[0]?.slug).toBe("profissional");
    } finally {
      await client.end();
    }
  });
});
