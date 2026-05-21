import express from "express";
import { beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { signAccessToken } from "../../src/modules/identity-access/application/jwt-service";
import { createEscritorioRouter } from "../../src/modules/portal-read/interfaces/http/escritorio-router";

const { automacaoTenantId, publicTenantId, configGetMock, configPatchMock, listReguaMock, createReguaMock } =
  vi.hoisted(() => ({
    automacaoTenantId: "tenant-automacao-config",
    publicTenantId: "00000000-0000-4000-8000-000000000088",
    configGetMock: vi.fn(),
    configPatchMock: vi.fn(),
    listReguaMock: vi.fn(),
    createReguaMock: vi.fn()
  }));

vi.mock("../../src/modules/portal-read/infrastructure/billing-tenant-link-repository", () => ({
  getPublicTenantIdForAutomacao: vi.fn().mockResolvedValue(publicTenantId)
}));

vi.mock("../../src/platform/persistence/with-tenant-transaction", () => ({
  withTenantTransaction: vi.fn(async (_tid: string, fn: (c: unknown) => unknown) => fn({}))
}));

vi.mock("../../src/modules/portal-read/application/escritorio-config-use-cases", () => ({
  getEscritorioConfigUseCase: (...args: unknown[]) => configGetMock(...args),
  patchEscritorioConfigUseCase: (...args: unknown[]) => configPatchMock(...args)
}));

vi.mock("../../src/modules/portal-read/application/charging-rules-use-cases", () => ({
  listChargingRules: (...args: unknown[]) => listReguaMock(...args),
  createChargingRule: (...args: unknown[]) => createReguaMock(...args),
  patchChargingRule: vi.fn(),
  deleteChargingRule: vi.fn()
}));

vi.mock("../../src/modules/portal-read/application/notification-templates-use-cases", () => ({
  listNotificationTemplates: vi.fn().mockResolvedValue([]),
  patchNotificationTemplate: vi.fn(),
  previewNotificationTemplate: vi.fn()
}));

vi.mock("../../src/modules/portal-read/application/escritorio-dashboard", () => ({
  getEscritorioDashboard: vi.fn(),
  resolveDashboardPeriod: vi.fn()
}));

vi.mock("../../src/modules/portal-read/application/escritorio-cobrancas-export", () => ({
  streamCobrancasCsvRows: vi.fn()
}));

vi.mock("../../src/modules/saas-billing/application/get-tenant-subscription", () => ({
  getTenantSubscriptionUseCase: vi.fn()
}));

vi.mock("../../src/modules/saas-billing/application/activate-platform-subscription", () => ({
  activatePlatformSubscription: vi.fn()
}));

function buildApp(membershipRole: "admin_escritorio" | "operador") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenantContext = { tenantId: automacaoTenantId };
    process.env.JWT_SECRET = "escritorio-config-router-test-secret";
    const token = signAccessToken({
      sub: "user-config",
      tid: automacaoTenantId,
      roles: ["owner"]
    });
    req.headers.authorization = `Bearer ${token}`;
    req.authContext = {
      userId: "user-config",
      tenantId: automacaoTenantId,
      roles: ["owner"]
    };
    req.portalMembership = { role: membershipRole, cpfCnpjCliente: null };
    next();
  });
  app.use("/v1/portal/escritorio", createEscritorioRouter());
  return app;
}

describe("GET/PATCH /v1/portal/escritorio/config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "escritorio-config-router-test-secret";
    configGetMock.mockResolvedValue({
      tenant_id: publicTenantId,
      razao_social: "Escritorio Demo",
      gateway_provider: "asaas",
      gateway_api_key: "****cdef"
    });
    configPatchMock.mockResolvedValue({
      tenant_id: publicTenantId,
      razao_social: "Escritorio Demo",
      gateway_provider: "asaas",
      gateway_api_key: "****cdef"
    });
  });

  it("GET config 200 para admin_escritorio", async () => {
    const app = buildApp("admin_escritorio");
    const res = await request(app).get("/v1/portal/escritorio/config").expect(200);
    expect(res.body.config?.gateway_provider).toBe("asaas");
    expect(configGetMock).toHaveBeenCalled();
  });

  it("PATCH config 200 para admin_escritorio", async () => {
    const app = buildApp("admin_escritorio");
    await request(app)
      .patch("/v1/portal/escritorio/config")
      .send({ gateway_provider: "asaas", gateway_api_key: "sandbox_key_12345" })
      .expect(200);
    expect(configPatchMock).toHaveBeenCalled();
  });

  it("PATCH config 403 para operador", async () => {
    const app = buildApp("operador");
    await request(app).patch("/v1/portal/escritorio/config").send({ razao_social: "X" }).expect(403);
    expect(configPatchMock).not.toHaveBeenCalled();
  });
});

describe("GET/POST /v1/portal/escritorio/regua", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = "escritorio-config-router-test-secret";
    listReguaMock.mockResolvedValue([
      { id: "rule-1", days_offset: -1, channel: "email", is_active: true }
    ]);
  });

  it("GET regua lista regras", async () => {
    const app = buildApp("admin_escritorio");
    const res = await request(app).get("/v1/portal/escritorio/regua").expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(listReguaMock).toHaveBeenCalled();
  });

  it("POST regua 409 quando regra duplicada", async () => {
    createReguaMock.mockRejectedValueOnce(new Error("DUPLICATE_RULE"));
    const app = buildApp("admin_escritorio");
    const res = await request(app)
      .post("/v1/portal/escritorio/regua")
      .send({ days_offset: 0, channel: "email" })
      .expect(409);
    expect(res.body?.error).toBe("duplicate_rule");
  });
});
