import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { closePool } from "../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDb)("Isolamento multi-tenant (RLS + API)", () => {
  const app = createApp();

  let tokenDemo = "";
  let tokenOther = "";

  beforeAll(async () => {
    try {
      const rDemo = await request(app).post("/v1/auth/token/mock").set("x-tenant-id", "demo");
      if (rDemo.status === 200 && rDemo.body?.access_token) {
        tokenDemo = rDemo.body.access_token as string;
      }
      const rOther = await request(app).post("/v1/auth/token/mock").set("x-tenant-id", "other");
      if (rOther.status === 200 && rOther.body?.access_token) {
        tokenOther = rOther.body.access_token as string;
      }
    } catch {
      /* Postgres indisponivel */
    }
  });

  afterAll(async () => {
    await closePool();
  });

  it("nao permite JWT de outro tenant no header atual", async (ctx) => {
    if (!tokenDemo || !tokenOther) {
      ctx.skip();
    }
    await request(app)
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "other")
      .expect(403);
  });

  it("cobranca criada no tenant demo nao aparece no tenant other", async (ctx) => {
    if (!tokenDemo || !tokenOther) {
      ctx.skip();
    }
    const ref = `ref-int-${Date.now()}`;
    const idem = `idem-int-${Date.now()}`;

    await request(app)
      .post("/v1/billing/charges")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .send({
        reference: ref,
        idempotency_key: idem,
        amount: 10.5,
        due_date: "2030-01-15"
      })
      .expect(201);

    const listDemo = await request(app)
      .get("/v1/billing/charges")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .expect(200);

    const listOther = await request(app)
      .get("/v1/billing/charges")
      .set("Authorization", `Bearer ${tokenOther}`)
      .set("x-tenant-id", "other")
      .expect(200);

    const idsDemo = (listDemo.body.charges as { reference: string }[]).map((c) => c.reference);
    const idsOther = (listOther.body.charges as { reference: string }[]).map((c) => c.reference);

    expect(idsDemo).toContain(ref);
    expect(idsOther).not.toContain(ref);
  });

  it("idempotencia: mesmo idempotency_key retorna mesma cobranca sem duplicar", async (ctx) => {
    if (!tokenDemo) {
      ctx.skip();
    }
    const ref = `ref-idem-${Date.now()}`;
    const idem = `idem-stable-${Date.now()}`;

    const first = await request(app)
      .post("/v1/billing/charges")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .send({
        reference: ref,
        idempotency_key: idem,
        amount: 20,
        due_date: "2030-02-01"
      })
      .expect(201);

    const second = await request(app)
      .post("/v1/billing/charges")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .send({
        reference: ref,
        idempotency_key: idem,
        amount: 20,
        due_date: "2030-02-01"
      })
      .expect(200);

    expect(first.body.idempotent).toBe(false);
    expect(second.body.idempotent).toBe(true);
    expect(first.body.charge.id).toBe(second.body.charge.id);
  });
});
