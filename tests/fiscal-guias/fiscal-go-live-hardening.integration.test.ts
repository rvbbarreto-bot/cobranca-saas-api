import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import {
  runSeedPortalHappyPath,
  SEED_PORTAL_DEFAULT_PASSWORD,
  SEED_PORTAL_EMAIL
} from "../../src/dev/seed-portal-happy-path";
import { closePool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

async function portalLogin(app: ReturnType<typeof createApp>, tenantId: string): Promise<string> {
  const r = await request(app)
    .post("/v1/portal/auth/login")
    .send({
      email: SEED_PORTAL_EMAIL,
      tenant_id: tenantId,
      password: SEED_PORTAL_DEFAULT_PASSWORD
    })
    .expect(200);
  return r.body.access_token as string;
}

describe.skipIf(!hasDb)("Fiscal go-live hardening — rollback flags (EXEQ-FISC-095)", () => {
  let tenantId = "";
  let token = "";
  const saved = {
    guias: process.env.FISCAL_GUIAS_ENABLED,
    serpro: process.env.FISCAL_SERPRO_ENABLED,
    enc: process.env.ENCRYPTION_KEY
  };

  beforeAll(async () => {
    process.env.ENCRYPTION_KEY =
      process.env.ENCRYPTION_KEY?.trim() ||
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    tenantId = seed.automacaoTenantId;
  });

  afterAll(async () => {
    if (saved.guias === undefined) delete process.env.FISCAL_GUIAS_ENABLED;
    else process.env.FISCAL_GUIAS_ENABLED = saved.guias;
    if (saved.serpro === undefined) delete process.env.FISCAL_SERPRO_ENABLED;
    else process.env.FISCAL_SERPRO_ENABLED = saved.serpro;
    if (saved.enc === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = saved.enc;
    await closePool().catch(() => undefined);
  });

  it("FISCAL_GUIAS_ENABLED=false oculta rotas /v1/portal/fiscal/*", async () => {
    process.env.FISCAL_GUIAS_ENABLED = "false";
    delete process.env.FISCAL_SERPRO_ENABLED;
    const app = createApp();
    token = await portalLogin(app, tenantId);

    const res = await request(app)
      .get("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", tenantId);

    expect(res.status).toBe(404);
  });

  it("FISCAL_SERPRO_ENABLED=false bloqueia POST processamentos (503)", async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.FISCAL_SERPRO_ENABLED = "false";
    const app = createApp();
    token = await portalLogin(app, tenantId);

    const res = await request(app)
      .post("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", tenantId)
      .send({ fiscal_ingest_id: "00000000-0000-4000-8000-000000000099" });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe("fiscal_serpro_disabled");
  });

  it("FISCAL_GUIAS_ENABLED=true lista processamentos vazios", async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.FISCAL_SERPRO_ENABLED = "true";
    const app = createApp();
    token = await portalLogin(app, tenantId);

    const res = await request(app)
      .get("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", tenantId);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.processamentos)).toBe(true);
  });
});
