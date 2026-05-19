import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { runSeedPortalHappyPath, SEED_PORTAL_DEFAULT_PASSWORD, SEED_PORTAL_EMAIL } from "../../src/dev/seed-portal-happy-path";
import { closePool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDb)("Sprint A — POST /v1/portal/auth/login", () => {
  const app = createApp();
  let automacaoTenantId = "";

  beforeAll(async () => {
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    automacaoTenantId = seed.automacaoTenantId;
  });

  afterAll(async () => {
    await closePool();
  });

  it("200 com email, tenant_id e senha do seed", async () => {
    const r = await request(app)
      .post("/v1/portal/auth/login")
      .send({
        email: SEED_PORTAL_EMAIL,
        tenant_id: automacaoTenantId,
        password: SEED_PORTAL_DEFAULT_PASSWORD
      })
      .expect(200);
    expect(r.body?.access_token).toBeTruthy();
  });

  it("401 com senha errada", async () => {
    await request(app)
      .post("/v1/portal/auth/login")
      .send({
        email: SEED_PORTAL_EMAIL,
        tenant_id: automacaoTenantId,
        password: "senha-errada-definitivamente"
      })
      .expect(401);
  });
});
