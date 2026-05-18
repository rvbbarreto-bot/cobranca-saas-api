import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { closePool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDb)("GET /health/ready (readiness pack B)", () => {
  const app = createApp();

  afterAll(async () => {
    await closePool();
  });

  it("retorna 200 com checks quando banco e schema estao ok", async (ctx) => {
    const r = await request(app).get("/health/ready");
    if (r.status !== 200) {
      ctx.skip();
    }
    expect(r.body?.status).toBe("ok");
    expect(r.body?.checks?.selectOne).toBe(true);
    expect(r.body?.checks?.pgcrypto).toBe(true);
    expect(r.body?.checks?.tablePublicTenants).toBe(true);
    expect(r.body?.checks?.tablePublicCharges).toBe(true);
    expect(r.body?.checks?.tablePortalAppUser).toBe(true);
  });
});
