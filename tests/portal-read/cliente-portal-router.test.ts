import express from "express";
import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { signClientePortalToken } from "../../src/modules/identity-access/application/jwt-service";
import { createClientePortalRouter } from "../../src/modules/portal-read/interfaces/http/cliente-portal-router";

const {
  automacaoTenantId,
  publicTenantId,
  clienteId,
  chargeOwned,
  chargeOther,
  listMock,
  ownsMock,
  detailMock
} = vi.hoisted(() => ({
  automacaoTenantId: "tenant-automacao-1",
  publicTenantId: "00000000-0000-4000-8000-000000000001",
  clienteId: "20000000-0000-4000-8000-000000000002",
  chargeOwned: "10000000-0000-4000-8000-000000000099",
  chargeOther: "10000000-0000-4000-8000-000000000088",
  listMock: vi.fn(),
  ownsMock: vi.fn(),
  detailMock: vi.fn()
}));

vi.mock("../../src/platform/tenancy/resolve-automacao-tenant-id", () => ({
  resolveAutomacaoTenantId: vi.fn().mockResolvedValue(automacaoTenantId)
}));

vi.mock("../../src/modules/portal-read/infrastructure/billing-tenant-link-repository", () => ({
  getPublicTenantIdForAutomacao: vi.fn().mockResolvedValue(publicTenantId)
}));

vi.mock("../../src/platform/persistence/with-tenant-transaction", () => ({
  withTenantTransaction: vi.fn(async (_tid: string, fn: (c: unknown) => unknown) => fn({}))
}));

vi.mock("../../src/modules/portal-read/application/cliente-portal-cobrancas", () => ({
  listClienteCobrancas: (...args: unknown[]) => listMock(...args),
  clienteOwnsCharge: (...args: unknown[]) => ownsMock(...args),
  getClienteCobrancaDetail: (...args: unknown[]) => detailMock(...args)
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/v1/portal/cliente", createClientePortalRouter());
  return app;
}

function clienteAuthHeaders() {
  const prev = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "test-cliente-portal-secret";
  const token = signClientePortalToken(clienteId, automacaoTenantId);
  if (prev === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = prev;
  }
  return {
    Authorization: `Bearer ${token}`,
    "x-tenant-id": automacaoTenantId
  };
}

describe("cliente portal router — cobrancas", () => {
  beforeEach(() => {
    listMock.mockReset();
    ownsMock.mockReset();
    detailMock.mockReset();
    process.env.JWT_SECRET = "test-cliente-portal-secret";
  });

  it("GET /cobrancas sem JWT → 401", async () => {
    const app = buildApp();
    await request(app)
      .get("/v1/portal/cliente/cobrancas")
      .set("x-tenant-id", automacaoTenantId)
      .expect(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it("GET /cobrancas com JWT válido lista cobranças do cliente", async () => {
    listMock.mockResolvedValue([
      {
        id: chargeOwned,
        canonical_status: "pendente_pagamento",
        amount: "50.00",
        due_date: "2026-06-01",
        description: "Ref",
        type: "boleto",
        payment: null
      }
    ]);

    const app = buildApp();
    const res = await request(app)
      .get("/v1/portal/cliente/cobrancas")
      .set(clienteAuthHeaders())
      .expect(200);

    expect(res.body.data).toHaveLength(1);
    expect(listMock).toHaveBeenCalledWith(
      expect.anything(),
      publicTenantId,
      clienteId,
      expect.objectContaining({ page: 1, limit: 20 })
    );
  });

  it("GET /cobrancas?status=paga repassa filtro de status", async () => {
    listMock.mockResolvedValue([]);

    const app = buildApp();
    await request(app)
      .get("/v1/portal/cliente/cobrancas")
      .query({ status: "paga" })
      .set(clienteAuthHeaders())
      .expect(200);

    expect(listMock).toHaveBeenCalledWith(
      expect.anything(),
      publicTenantId,
      clienteId,
      expect.objectContaining({ status: "paga" })
    );
  });

  it("GET /cobrancas/:id de cobrança de outro cliente → 403", async () => {
    ownsMock.mockResolvedValue(false);

    const app = buildApp();
    await request(app)
      .get(`/v1/portal/cliente/cobrancas/${chargeOther}`)
      .set(clienteAuthHeaders())
      .expect(403);

    expect(detailMock).not.toHaveBeenCalled();
  });
});
