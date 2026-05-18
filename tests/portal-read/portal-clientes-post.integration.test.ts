import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app";
import {
  runSeedPortalHappyPath,
  SEED_AUTOMACAO_SLUG,
  SEED_PORTAL_EMAIL
} from "../../src/dev/seed-portal-happy-path";
import { closePool } from "../../src/platform/persistence/pool";
import { uniqueTestCnpj } from "../../src/modules/portal-read/application/br-cpf-cnpj";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const runStress = process.env.RUN_PORTAL_CLIENTES_STRESS === "1";

function portalAuthHeaders(token: string): { Authorization: string; "x-tenant-id": string } {
  return { Authorization: `Bearer ${token}`, "x-tenant-id": SEED_AUTOMACAO_SLUG };
}

describe.skipIf(!hasDb)("POST /v1/portal/clientes — integracao, validacao e carga opcional", () => {
  const app = createApp();
  let tokenPortal = "";
  let automacaoTenantId = "";

  beforeAll(async () => {
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    automacaoTenantId = seed.automacaoTenantId;
    const rPortal = await request(app)
      .post("/v1/portal/auth/token/mock")
      .send({ email: SEED_PORTAL_EMAIL, tenant_id: automacaoTenantId });
    expect(rPortal.status).toBe(200);
    tokenPortal = rPortal.body.access_token as string;
  });

  afterAll(async () => {
    await closePool();
  });

  it("201 cria cliente com CNPJ unico por execucao", async () => {
    const documento = uniqueTestCnpj(Date.now(), Math.floor(Math.random() * 1e6));
    const r = await request(app)
      .post("/v1/portal/clientes")
      .set(portalAuthHeaders(tokenPortal))
      .send({
        documento,
        nome: `Cliente integracao ${documento.slice(-6)}`,
        email: null,
        whatsapp_opt_in: false
      })
      .expect(201);
    expect(r.body?.cliente?.id).toBeTruthy();
    expect(r.body?.cliente?.documento).toBe(documento);
    expect(r.body?.cliente?.tenant_id).toBe(automacaoTenantId);
  });

  it("409 ao repetir mesmo documento (unicidade por tenant)", async () => {
    const documento = uniqueTestCnpj(Date.now() + 777, 42);
    const body = {
      documento,
      nome: "Duplicado teste",
      email: null,
      whatsapp_opt_in: true
    };
    await request(app).post("/v1/portal/clientes").set(portalAuthHeaders(tokenPortal)).send(body).expect(201);
    const r2 = await request(app).post("/v1/portal/clientes").set(portalAuthHeaders(tokenPortal)).send(body).expect(409);
    expect(r2.body?.error).toBe("unique_violation");
  });

  it("422 documento com DV invalido", async () => {
    const r = await request(app)
      .post("/v1/portal/clientes")
      .set(portalAuthHeaders(tokenPortal))
      .send({
        documento: "12345678901234",
        nome: "X",
        whatsapp_opt_in: false
      })
      .expect(422);
    expect(r.body?.error).toBe("validation_error");
    expect(Array.isArray(r.body?.issues)).toBe(true);
    const docIssue = (r.body.issues as { path: string }[]).find((i) => i.path === "documento");
    expect(docIssue).toBeTruthy();
  });

  it("422 CPF/CNPJ com tamanho errado", async () => {
    const r = await request(app)
      .post("/v1/portal/clientes")
      .set(portalAuthHeaders(tokenPortal))
      .send({
        documento: "123",
        nome: "Curto",
        whatsapp_opt_in: false
      })
      .expect(422);
    expect(r.body?.error).toBe("validation_error");
  });

  it("422 email mal formado", async () => {
    const documento = uniqueTestCnpj(Date.now() + 3333, 99);
    const r = await request(app)
      .post("/v1/portal/clientes")
      .set(portalAuthHeaders(tokenPortal))
      .send({
        documento,
        nome: "Com email ruim",
        email: "nao-e-email",
        whatsapp_opt_in: false
      })
      .expect(422);
    expect(r.body?.error).toBe("validation_error");
    const em = (r.body.issues as { path: string }[]).find((i) => i.path === "email");
    expect(em).toBeTruthy();
  });

  it("422 nome vazio", async () => {
    const documento = uniqueTestCnpj(Date.now() + 4444, 11);
    const r = await request(app)
      .post("/v1/portal/clientes")
      .set(portalAuthHeaders(tokenPortal))
      .send({
        documento,
        nome: "   ",
        whatsapp_opt_in: false
      })
      .expect(422);
    expect(r.body?.error).toBe("validation_error");
  });

  it("401 sem Bearer", async () => {
    const documento = uniqueTestCnpj(Date.now() + 5555, 22);
    await request(app)
      .post("/v1/portal/clientes")
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .send({
        documento,
        nome: "Sem auth",
        whatsapp_opt_in: false
      })
      .expect(401);
  });

  it.skipIf(!runStress)("insercoes concorrentes com CNPJ distintos (RUN_PORTAL_CLIENTES_STRESS=1)", async () => {
    const base = Date.now();
    const concurrency = Number(process.env.STRESS_CONCURRENCY ?? "20");
    const batches = Number(process.env.STRESS_BATCHES ?? "3");
    let ok = 0;
    for (let b = 0; b < batches; b += 1) {
      const batch = Array.from({ length: concurrency }, (_, i) => {
        const documento = uniqueTestCnpj(base + b * 100000 + i, i * 17 + b);
        return request(app)
          .post("/v1/portal/clientes")
          .set(portalAuthHeaders(tokenPortal))
          .send({
            documento,
            nome: `Stress ${b}-${i}`,
            email: null,
            whatsapp_opt_in: false
          })
          .then((res) => {
            if (res.status === 201) {
              ok += 1;
            }
            return res.status;
          });
      });
      const statuses = await Promise.all(batch);
      expect(statuses.every((s) => s === 201)).toBe(true);
    }
    expect(ok).toBe(concurrency * batches);
  });
});
