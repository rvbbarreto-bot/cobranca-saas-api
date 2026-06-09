import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import {
  runSeedPortalHappyPath,
  SEED_PORTAL_DEFAULT_PASSWORD,
  SEED_PORTAL_EMAIL
} from "../../src/dev/seed-portal-happy-path";
import { closePool, getPool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

async function portalLogin(app: ReturnType<typeof createApp>, automacaoTenantId: string): Promise<string> {
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

describe.skipIf(!hasDb)("EXEQ-FISC-071 — dashboard fiscal portal", () => {
  let app: ReturnType<typeof createApp>;
  let tenantId = "";
  let token = "";
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    app = createApp();
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    tenantId = seed.automacaoTenantId;
    token = await portalLogin(app, tenantId);
    await getPool().query("SELECT 1");
  });

  afterAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = previousFlag;
    await closePool();
  });

  it("GET /v1/portal/fiscal/dashboard retorna KPIs e competência", async () => {
    const r = await request(app)
      .get("/v1/portal/fiscal/dashboard")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(r.body).toMatchObject({
      competencia_atual: expect.stringMatching(/^\d{4}-\d{2}$/),
      kpis: {
        processamentos_mes: expect.any(Number),
        erros_abertos: expect.any(Number),
        certificados_expirando: expect.any(Number)
      },
      ultimos_processamentos: expect.any(Array),
      certificados_expirando: expect.any(Array)
    });
  });
});
