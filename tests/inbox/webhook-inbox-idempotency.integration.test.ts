import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import { closePool, getPool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDb)("Inbox webhook — idempotencia (integracao)", () => {
  const app = createApp();
  const webhookSecret = process.env.WEBHOOK_INBOX_SECRET?.trim();

  beforeAll(async () => {
    /* pool warm-up */
    await getPool().query("SELECT 1");
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

  async function countInboxRows(externalEventId: string): Promise<number> {
    const pool = getPool();
    const r = await pool.query<{ c: string }>(
      `SELECT count(*)::text AS c
       FROM webhook_inbox wi
       INNER JOIN tenants t ON t.id = wi.tenant_id
       WHERE t.slug = 'demo'
         AND wi.external_event_id = $1`,
      [externalEventId]
    );
    return Number(r.rows[0]?.c ?? 0);
  }

  it("segundo POST com mesmo x-external-event-id retorna 200 deduplicated", async () => {
    const evt = `evt-dup-seq-${Date.now()}`;
    const payload = { source: "test", canonical_status: "emitida", reference: `ref-${evt}` };

    const first = await webhookReq()
      .set("x-external-event-id", evt)
      .send(payload)
      .expect(202);

    expect(first.body.accepted).toBe(true);
    expect(first.body.deduplicated).toBe(false);
    expect(first.body.already_processed).toBe(false);
    const firstId = first.body.id as string;
    expect(firstId).toBeTruthy();

    const second = await webhookReq()
      .set("x-external-event-id", evt)
      .send({ ...payload, note: "retry" })
      .expect(200);

    expect(second.body.accepted).toBe(true);
    expect(second.body.deduplicated).toBe(true);
    expect(second.body.already_processed).toBe(false);
    expect(second.body.id).toBe(firstId);

    expect(await countInboxRows(evt)).toBe(1);
  });

  it("apos process-pending, reenvio do mesmo evento marca already_processed", async () => {
    const tokenRes = await request(app).post("/v1/auth/token/mock").set("x-tenant-id", "demo");
    if (tokenRes.status !== 200 || !tokenRes.body?.access_token) {
      return;
    }
    const token = tokenRes.body.access_token as string;

    const ref = `idem-proc-${Date.now()}`;
    const evt = `evt-proc-${Date.now()}`;

    await request(app)
      .post("/v1/billing/charges")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", "demo")
      .send({
        reference: ref,
        idempotency_key: `idem-${ref}`,
        amount_cents: 100,
        canonical_status: "emitida"
      })
      .expect(201);

    await webhookReq()
      .set("x-external-event-id", evt)
      .send({ canonical_status: "paga", reference: ref })
      .expect(202);

    await request(app)
      .post("/v1/inbox/webhooks/process-pending?limit=50")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", "demo")
      .expect(200);

    const retry = await webhookReq()
      .set("x-external-event-id", evt)
      .send({ canonical_status: "paga", reference: ref })
      .expect(200);

    expect(retry.body.deduplicated).toBe(true);
    expect(retry.body.already_processed).toBe(true);
    expect(await countInboxRows(evt)).toBe(1);
  });

  it("carga leve: POSTs concorrentes com mesmo external_event_id geram uma linha", async () => {
    const evt = `evt-conc-${Date.now()}`;
    const payload = { source: "test", ping: true };

    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        webhookReq().set("x-external-event-id", evt).send(payload)
      )
    );

    for (const res of results) {
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(res.body.accepted).toBe(true);
    }

    const inserted = results.filter((r) => r.status === 202);
    const deduped = results.filter((r) => r.status === 200 && r.body.deduplicated === true);
    expect(inserted.length).toBe(1);
    expect(deduped.length).toBe(7);

    const ids = new Set(results.map((r) => r.body.id).filter(Boolean));
    expect(ids.size).toBe(1);
    expect(await countInboxRows(evt)).toBe(1);
  });
});
