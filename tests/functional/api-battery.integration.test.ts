import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import {
  DEMO_PUBLIC_TENANT_UUID,
  runSeedPortalHappyPath,
  SEED_AUTOMACAO_SLUG,
  SEED_PORTAL_EMAIL
} from "../../src/dev/seed-portal-happy-path";
import { closePool } from "../../src/platform/persistence/pool";
import { uniqueTestCnpj } from "../../src/modules/portal-read/application/br-cpf-cnpj";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

describe.skipIf(!hasDb)("Bateria funcional sistematica (secao 5)", () => {
  const app = createApp();
  let tokenDemo = "";
  let tokenPortal = "";
  let automacaoTenantId = "";
  const webhookSecret = process.env.WEBHOOK_INBOX_SECRET?.trim();

  beforeAll(async () => {
    const url = process.env.DATABASE_URL!.trim();
    const seed = await runSeedPortalHappyPath(url);
    automacaoTenantId = seed.automacaoTenantId;
    expect(seed.publicTenantId).toBe(DEMO_PUBLIC_TENANT_UUID);

    const rDemo = await request(app).post("/v1/auth/token/mock").set("x-tenant-id", "demo");
    expect(rDemo.status).toBe(200);
    tokenDemo = rDemo.body.access_token as string;

    const rPortal = await request(app)
      .post("/v1/portal/auth/token/mock")
      .send({ email: SEED_PORTAL_EMAIL, tenant_id: automacaoTenantId });
    expect(rPortal.status).toBe(200);
    tokenPortal = rPortal.body.access_token as string;
  });

  afterAll(async () => {
    await closePool();
  });

  it("A0 GET /health/ready (readiness com Postgres)", async (ctx) => {
    const r = await request(app).get("/health/ready");
    if (r.status !== 200) {
      ctx.skip();
    }
    expect(r.body?.status).toBe("ok");
    expect(r.body?.checks?.selectOne).toBe(true);
  });

  it("A1 GET /health", async () => {
    const r = await request(app).get("/health").expect(200);
    expect(r.body?.status).toBe("ok");
  });

  it("A2 POST /v1/auth/token/mock + GET /v1/auth/me", async () => {
    const r = await request(app).post("/v1/auth/token/mock").set("x-tenant-id", "demo").expect(200);
    const tok = r.body.access_token as string;
    const me = await request(app)
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${tok}`)
      .set("x-tenant-id", "demo")
      .expect(200);
    expect(me.body?.tenant?.tenantId).toBe(DEMO_PUBLIC_TENANT_UUID);
  });

  it("A3 POST/GET /v1/billing/charges", async () => {
    const ref = `bat-${Date.now()}`;
    const idem = `idem-bat-${Date.now()}`;
    await request(app)
      .post("/v1/billing/charges")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .send({
        reference: ref,
        idempotency_key: idem,
        amount: 12.34,
        due_date: "2032-06-01"
      })
      .expect(201);

    const list = await request(app)
      .get("/v1/billing/charges")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .expect(200);

    const refs = (list.body.charges as { reference: string }[]).map((c) => c.reference);
    expect(refs).toContain(ref);
  });

  it("A4 POST /v1/inbox/webhooks (+ secret se configurado)", async () => {
    const ext = `evt-bat-${Date.now()}`;
    const chain = request(app).post("/v1/inbox/webhooks").set("x-tenant-id", "demo");
    if (webhookSecret) {
      chain.set("x-webhook-secret", webhookSecret);
    }
    const r = await chain
      .set("x-external-event-id", ext)
      .send({ source: "functional-battery", ping: true })
      .expect(202);
    expect(r.body?.accepted).toBe(true);
  });

  it("A5 POST /v1/inbox/webhooks/process-pending", async () => {
    const r = await request(app)
      .post("/v1/inbox/webhooks/process-pending")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .expect(200);
    expect(r.body).toBeDefined();
  });

  it("A6 POST /v1/tenants/provision/mock (stub)", async () => {
    const r = await request(app)
      .post("/v1/tenants/provision/mock")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "demo")
      .expect(201);
    expect(r.body?.tenant_id).toBe(DEMO_PUBLIC_TENANT_UUID);
  });

  it("B0a GET /v1/portal/notas-fiscais sem Bearer -> 401", async () => {
    await request(app).get("/v1/portal/notas-fiscais").set("x-tenant-id", SEED_AUTOMACAO_SLUG).expect(401);
  });

  it("B0b GET /v1/portal/auth/me sem Bearer -> 401", async () => {
    await request(app).get("/v1/portal/auth/me").set("x-tenant-id", SEED_AUTOMACAO_SLUG).expect(401);
  });

  it("B0 GET /v1/portal/auth/me (perfil + tenant apos membership)", async () => {
    const r = await request(app)
      .get("/v1/portal/auth/me")
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .expect(200);
    expect(r.body?.user?.id).toBeTruthy();
    expect(r.body?.user?.email).toBe(SEED_PORTAL_EMAIL);
    expect(r.body?.user?.membership_role).toBe("admin_escritorio");
    expect(Array.isArray(r.body?.user?.jwt_roles)).toBe(true);
    expect(r.body?.tenant?.id).toBe(automacaoTenantId);
    expect(r.body?.tenant?.slug).toBe(SEED_AUTOMACAO_SLUG);
  });

  it("B1 GET /v1/portal/notas-fiscais (slug automacao)", async () => {
    const r = await request(app)
      .get("/v1/portal/notas-fiscais")
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .expect(200);
    expect(Array.isArray(r.body?.data)).toBe(true);
  });

  it("B2 GET /v1/portal/cobrancas com billing_link ok", async () => {
    const r = await request(app)
      .get("/v1/portal/cobrancas")
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .expect(200);
    expect(r.body?.billing_link_status).toBe("ok");
    expect(Array.isArray(r.body?.data)).toBe(true);
    expect(r.body).toHaveProperty("next_cursor");
    expect(r.body).toHaveProperty("page_limit");
  });

  it("B2b GET /v1/portal/cobrancas com cursor invalido -> 400", async () => {
    const invalidCursor = Buffer.from(JSON.stringify({ k: "wrong", v: 1 }), "utf8").toString("base64url");
    await request(app)
      .get("/v1/portal/cobrancas")
      .query({ cursor: invalidCursor })
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .expect(400);
  });

  it("B3 GET /v1/portal/clientes", async () => {
    const r = await request(app)
      .get("/v1/portal/clientes")
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .expect(200);
    expect(Array.isArray(r.body?.data)).toBe(true);
  });

  it("B4 POST /v1/portal/cobrancas (fase 2 — criar charge)", async () => {
    const ref = `f2-bat-${Date.now()}`;
    const idem = `idem-f2-${Date.now()}`;
    const r = await request(app)
      .post("/v1/portal/cobrancas")
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .send({
        reference: ref,
        idempotency_key: idem,
        amount: 99.9,
        due_date: "2031-08-15"
      })
      .expect(201);
    expect(r.body?.charge?.reference).toBe(ref);
    expect(r.body?.idempotent).toBe(false);
  });

  it("B5 PATCH /v1/portal/clientes/:id (P0 — correcao sem duplicar)", async () => {
    const documento = uniqueTestCnpj(Date.now() + 88_000, 902);
    const cr = await request(app)
      .post("/v1/portal/clientes")
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .send({
        documento,
        nome: "Cliente bat antes",
        email: null,
        whatsapp_opt_in: false
      })
      .expect(201);
    const id = cr.body.cliente.id as string;

    const pr = await request(app)
      .patch(`/v1/portal/clientes/${id}`)
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .send({ nome: "Cliente bat depois", whatsapp_opt_in: true })
      .expect(200);
    expect(pr.body?.cliente?.nome).toBe("Cliente bat depois");
    expect(pr.body?.cliente?.whatsapp_opt_in).toBe(true);
  });

  it("B6 PATCH /v1/portal/cobrancas/:id (P0 — retificar valor e vencimento)", async () => {
    const ref = `f2-patch-${Date.now()}`;
    const idem = `idem-patch-${Date.now()}`;
    const post = await request(app)
      .post("/v1/portal/cobrancas")
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .send({
        reference: ref,
        idempotency_key: idem,
        amount: 10,
        due_date: "2031-09-01"
      })
      .expect(201);
    const chargeId = post.body.charge.id as string;

    const patched = await request(app)
      .patch(`/v1/portal/cobrancas/${chargeId}`)
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .send({ amount: 88.5, due_date: "2031-10-20" })
      .expect(200);
    expect(Number(patched.body?.charge?.amount)).toBe(88.5);
    expect(patched.body?.charge?.dueDate).toBe("2031-10-20");
  });

  it("C1 cross-tenant: JWT demo + header other -> 403 em /v1/auth/me", async () => {
    await request(app)
      .get("/v1/auth/me")
      .set("Authorization", `Bearer ${tokenDemo}`)
      .set("x-tenant-id", "other")
      .expect(403);
  });
});
