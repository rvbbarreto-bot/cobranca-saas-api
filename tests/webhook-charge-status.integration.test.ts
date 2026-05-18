import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { closePool } from "../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDb)("Webhook inbox + maquina de estados (integracao)", () => {
  const app = createApp();
  let tokenDemo = "";

  const webhookSecret = process.env.WEBHOOK_INBOX_SECRET?.trim();

  beforeAll(async () => {
    try {
      const rDemo = await request(app).post("/v1/auth/token/mock").set("x-tenant-id", "demo");
      if (rDemo.status === 200 && rDemo.body?.access_token) {
        tokenDemo = rDemo.body.access_token as string;
      }
    } catch {
      /* Postgres indisponivel ou migracoes ausentes */
    }
  });

  afterAll(async () => {
    await closePool();
  });

  function webhookReq() {
    const chain = request(app).post("/v1/inbox/webhooks").set("x-tenant-id", "demo");
    if (webhookSecret) {
      chain.set("x-webhook-secret", webhookSecret);
    }
    return chain;
  }

  it("webhook legal atualiza status da cobranca", async (ctx) => {
    if (!tokenDemo) {
      ctx.skip();
    }
    const ref = `hook-ok-${Date.now()}`;
    const idem = `idem-hook-ok-${Date.now()}`;

    await request(app)
      .post("/v1/billing/charges")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .send({
        reference: ref,
        idempotency_key: idem,
        amount: 15,
        due_date: "2031-05-01"
      })
      .expect(201);

    await webhookReq()
      .set("x-external-event-id", `evt-ok-${ref}`)
      .send({
        canonical_status: "pendente_pagamento",
        reference: ref
      })
      .expect(202);

    const proc = await request(app)
      .post("/v1/inbox/webhooks/process-pending?limit=100")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .expect(200);

    expect(proc.body.updated).toBeGreaterThanOrEqual(1);

    const list = await request(app)
      .get("/v1/billing/charges?limit=200")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .expect(200);

    const hit = (list.body.charges as { reference: string; canonicalStatus: string }[]).find(
      (c) => c.reference === ref
    );
    expect(hit?.canonicalStatus).toBe("pendente_pagamento");
  });

  it("webhook com transicao ilegal nao altera cobranca paga", async (ctx) => {
    if (!tokenDemo) {
      ctx.skip();
    }
    const ref = `hook-bad-${Date.now()}`;
    const idem = `idem-hook-bad-${Date.now()}`;

    await request(app)
      .post("/v1/billing/charges")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .send({
        reference: ref,
        idempotency_key: idem,
        amount: 9,
        due_date: "2031-06-01"
      })
      .expect(201);

    await webhookReq()
      .set("x-external-event-id", `evt-paga-${ref}`)
      .send({ canonical_status: "paga", reference: ref })
      .expect(202);

    await request(app)
      .post("/v1/inbox/webhooks/process-pending?limit=100")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .expect(200);

    await webhookReq()
      .set("x-external-event-id", `evt-bad-${ref}`)
      .send({ canonical_status: "emitida", reference: ref })
      .expect(202);

    const proc2 = await request(app)
      .post("/v1/inbox/webhooks/process-pending?limit=100")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .expect(200);

    expect(proc2.body.dead_illegal_transition).toBeGreaterThanOrEqual(1);

    const list = await request(app)
      .get("/v1/billing/charges?limit=200")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .expect(200);

    const hit = (list.body.charges as { reference: string; canonicalStatus: string }[]).find(
      (c) => c.reference === ref
    );
    expect(hit?.canonicalStatus).toBe("paga");
  });
});
