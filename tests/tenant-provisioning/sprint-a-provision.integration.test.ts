import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { closePool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDb)("Sprint A — POST /v1/tenants/provision", () => {
  const app = createApp();
  let token = "";

  beforeAll(async () => {
    const r = await request(app).post("/v1/auth/token/mock").set("x-tenant-id", "demo");
    expect(r.status).toBe(200);
    token = r.body.access_token as string;
  });

  afterAll(async () => {
    await closePool();
  });

  it("201 cria tenant publico com slug unico", async () => {
    const slug = `saas-ci-${Date.now()}`;
    const res = await request(app)
      .post("/v1/tenants/provision")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", "demo")
      .send({ slug, name: "Tenant CI Sprint A", status: "trial" })
      .expect(201);
    expect(res.body?.tenant?.slug).toBe(slug);
    expect(res.body?.tenant?.id).toBeTruthy();
    expect(res.body?.billing_linked).toBe(false);
  });

  it("409 ao repetir slug", async () => {
    const slug = `dup-${Date.now()}`;
    await request(app)
      .post("/v1/tenants/provision")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", "demo")
      .send({ slug, name: "Primeiro", status: "trial" })
      .expect(201);

    await request(app)
      .post("/v1/tenants/provision")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", "demo")
      .send({ slug, name: "Segundo", status: "trial" })
      .expect(409);
  });
});
