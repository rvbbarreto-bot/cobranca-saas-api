import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { signAccessToken } from "../../src/modules/identity-access/application/jwt-service";
import { createEscritorioRouter } from "../../src/modules/portal-read/interfaces/http/escritorio-router";

const { automacaoTenantId, publicTenantId, subscriptionMock } = vi.hoisted(() => ({
  automacaoTenantId: "tenant-automacao-assinatura",
  publicTenantId: "00000000-0000-4000-8000-000000000099",
  subscriptionMock: vi.fn()
}));

vi.mock("../../src/modules/portal-read/infrastructure/billing-tenant-link-repository", () => ({
  getPublicTenantIdForAutomacao: vi.fn().mockResolvedValue(publicTenantId)
}));

vi.mock("../../src/platform/persistence/with-tenant-transaction", () => ({
  withTenantTransaction: vi.fn(async (_tid: string, fn: (c: unknown) => unknown) => fn({}))
}));

vi.mock("../../src/modules/saas-billing/application/get-tenant-subscription", () => ({
  getTenantSubscriptionUseCase: (...args: unknown[]) => subscriptionMock(...args)
}));

function buildApp(membershipRole: "admin_escritorio" | "operador") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenantContext = { tenantId: automacaoTenantId };
    process.env.JWT_SECRET = "assinatura-router-test-secret";
    const token = signAccessToken({
      sub: "user-assinatura",
      tid: automacaoTenantId,
      roles: ["owner"]
    });
    req.headers.authorization = `Bearer ${token}`;
    req.authContext = {
      userId: "user-assinatura",
      tenantId: automacaoTenantId,
      roles: ["owner"]
    };
    req.portalMembership = { role: membershipRole, cpfCnpjCliente: null };
    next();
  });
  app.use("/v1/portal/escritorio", createEscritorioRouter());
  return app;
}

describe("GET /v1/portal/escritorio/assinatura", () => {
  beforeEach(() => {
    subscriptionMock.mockReset();
    process.env.JWT_SECRET = "assinatura-router-test-secret";
  });

  it("200 com payload para admin_escritorio", async () => {
    const payload = {
      id: "sub-1",
      status: "trial",
      read_only: false,
      trial_ends_at: "2026-06-01T00:00:00.000Z",
      current_period_start: null,
      current_period_end: null,
      plano: {
        id: "plan-1",
        slug: "profissional",
        nome: "Profissional",
        max_clientes: 250,
        max_cobrancas_mes: 2000,
        preco_mensal: 299
      },
      uso: { year_month: "2026-05", clientes: 3, cobrancas_criadas_mes: 12 }
    };
    subscriptionMock.mockResolvedValue(payload);

    const app = buildApp("admin_escritorio");
    const res = await request(app).get("/v1/portal/escritorio/assinatura").expect(200);

    expect(res.body.assinatura).toEqual(payload);
    expect(subscriptionMock).toHaveBeenCalledWith(expect.anything(), publicTenantId);
  });

  it("403 para operador", async () => {
    const app = buildApp("operador");
    await request(app).get("/v1/portal/escritorio/assinatura").expect(403);
    expect(subscriptionMock).not.toHaveBeenCalled();
  });

  it("404 quando nao ha assinatura", async () => {
    subscriptionMock.mockResolvedValue(null);
    const app = buildApp("admin_escritorio");
    const res = await request(app).get("/v1/portal/escritorio/assinatura").expect(404);
    expect(res.body?.error).toBe("subscription_not_found");
  });
});
