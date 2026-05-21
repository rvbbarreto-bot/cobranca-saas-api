import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { closePool } from "../../src/platform/persistence/pool";

vi.mock("../../src/platform/tenancy/resolve-tenant-uuid", () => ({
  resolveTenantUuid: vi.fn(async () => "00000000-0000-4000-8000-000000000001")
}));

const STRONG_JWT = "0123456789abcdefghijklmnopqrstuvwxyzABCD";

describe("Producao — mock auth routes bloqueadas (FASE2 A)", () => {
  let app: Express;

  beforeAll(async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_MOCK_AUTH", "false");
    vi.stubEnv("JWT_SECRET", STRONG_JWT);
    vi.stubEnv("WEBHOOK_INBOX_SECRET", "whsec_test_min_32_chars_______________");

    const { createApp } = await import("../../src/app");
    app = createApp();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await closePool();
  });

  it("POST /v1/auth/token/mock retorna 404", async () => {
    const r = await request(app).post("/v1/auth/token/mock").set("x-tenant-id", "demo");
    expect(r.status).toBe(404);
    expect(r.body?.error).toBe("not_found");
  });

  it("POST /v1/portal/auth/token/mock retorna 404", async () => {
    const r = await request(app)
      .post("/v1/portal/auth/token/mock")
      .send({ email: "x@test.com", tenant_id: "1" });
    expect(r.status).toBe(404);
    expect(r.body?.error).toBe("not_found");
  });

  it("POST /v1/tenants/provision/mock retorna 404", async () => {
    const r = await request(app)
      .post("/v1/tenants/provision/mock")
      .set("Authorization", "Bearer dummy")
      .set("x-tenant-id", "00000000-0000-4000-8000-000000000001");
    expect(r.status).toBe(404);
    expect(r.body?.error).toBe("not_found");
  });
});
