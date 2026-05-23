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

function portalAuthHeaders(token: string): { Authorization: string; "x-tenant-id": string } {
  return { Authorization: `Bearer ${token}`, "x-tenant-id": SEED_AUTOMACAO_SLUG };
}

describe.skipIf(!hasDb)("GET /v1/portal/clientes/:clienteId", () => {
  const app = createApp();
  let tokenPortal = "";
  let automacaoTenantId = "";
  let clienteId = "";

  beforeAll(async () => {
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    automacaoTenantId = seed.automacaoTenantId;
    const rPortal = await request(app)
      .post("/v1/portal/auth/token/mock")
      .send({ email: SEED_PORTAL_EMAIL, tenant_id: automacaoTenantId });
    expect(rPortal.status).toBe(200);
    tokenPortal = rPortal.body.access_token as string;

    const documento = uniqueTestCnpj(Date.now(), 101);
    const created = await request(app)
      .post("/v1/portal/clientes")
      .set(portalAuthHeaders(tokenPortal))
      .send({
        documento,
        nome: "Cliente GET teste",
        email: `get+${documento.slice(-6)}@test.local`,
        whatsapp_opt_in: false
      })
      .expect(201);
    clienteId = created.body.cliente.id as string;
  });

  afterAll(async () => {
    await closePool();
  });

  it("200 retorna cliente por id", async () => {
    const r = await request(app)
      .get(`/v1/portal/clientes/${clienteId}`)
      .set(portalAuthHeaders(tokenPortal))
      .expect(200);
    expect(r.body.cliente?.id).toBe(clienteId);
    expect(r.body.cliente?.nome).toBe("Cliente GET teste");
  });

  it("404 para id inexistente", async () => {
    await request(app)
      .get("/v1/portal/clientes/550e8400-e29b-41d4-a716-446655440000")
      .set(portalAuthHeaders(tokenPortal))
      .expect(404);
  });
});
