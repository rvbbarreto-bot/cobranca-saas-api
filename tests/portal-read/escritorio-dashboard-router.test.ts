import express from "express";
import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { signAccessToken } from "../../src/modules/identity-access/application/jwt-service";
import { createEscritorioRouter } from "../../src/modules/portal-read/interfaces/http/escritorio-router";

const { automacaoTenantId, publicTenantId, dashboardMock } = vi.hoisted(() => ({
  automacaoTenantId: "tenant-automacao-esc",
  publicTenantId: "00000000-0000-4000-8000-000000000001",
  dashboardMock: vi.fn()
}));

vi.mock("../../src/modules/portal-read/infrastructure/billing-tenant-link-repository", () => ({
  getPublicTenantIdForAutomacao: vi.fn().mockResolvedValue(publicTenantId)
}));

vi.mock("../../src/platform/persistence/with-tenant-transaction", () => ({
  withTenantTransaction: vi.fn(async (_tid: string, fn: (c: unknown) => unknown) => fn({}))
}));

vi.mock("../../src/modules/portal-read/application/escritorio-dashboard", async (importOriginal) => {
  const mod = await importOriginal<
    typeof import("../../src/modules/portal-read/application/escritorio-dashboard")
  >();
  return {
    ...mod,
    getEscritorioDashboard: (...args: unknown[]) => dashboardMock(...args)
  };
});

function buildApp(membershipRole: "admin_escritorio" | "operador", jwtRoles: string[] = ["owner"]) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenantContext = { tenantId: automacaoTenantId };
    process.env.JWT_SECRET = "dashboard-router-test-secret";
    const token = signAccessToken({
      sub: "user-1",
      tid: automacaoTenantId,
      roles: jwtRoles as never
    });
    req.headers.authorization = `Bearer ${token}`;
    req.authContext = {
      userId: "user-1",
      tenantId: automacaoTenantId,
      roles: jwtRoles as never
    };
    req.portalMembership = { role: membershipRole, cpfCnpjCliente: null };
    next();
  });
  app.use("/v1/portal/escritorio", createEscritorioRouter());
  return app;
}

describe("GET /v1/portal/escritorio/dashboard", () => {
  beforeEach(() => {
    dashboardMock.mockReset();
    process.env.JWT_SECRET = "dashboard-router-test-secret";
  });

  it("retorna 200 com payload do dashboard para operador", async () => {
    const payload = {
      periodo: { inicio: "2026-04-19", fim: "2026-05-18" },
      cobrancas: {
        total: 1,
        por_status: {
          rascunho: 0,
          emitida: 0,
          enviada: 0,
          pendente_pagamento: 1,
          paga: 0,
          vencida: 0,
          cancelada: 0,
          erro_emissao: 0
        },
        valor_total_emitido: 100,
        valor_total_recebido: 0,
        valor_total_vencido: 0,
        taxa_conversao: 0
      },
      notificacoes: { total_enviadas: 0, total_falhas: 0, por_canal: { email: 0, whatsapp: 0 } },
      top_clientes_inadimplentes: []
    };
    dashboardMock.mockResolvedValue(payload);

    const app = buildApp("operador");
    const res = await request(app)
      .get("/v1/portal/escritorio/dashboard")
      .query({ periodo: "30d" })
      .expect(200);

    expect(res.body).toEqual(payload);
    expect(dashboardMock).toHaveBeenCalledWith(
      expect.anything(),
      publicTenantId,
      expect.objectContaining({ fim: expect.any(String) })
    );
  });

  it("viewer no JWT → 403", async () => {
    const app = buildApp("operador", ["viewer"]);
    await request(app).get("/v1/portal/escritorio/dashboard").expect(403);
    expect(dashboardMock).not.toHaveBeenCalled();
  });
});
