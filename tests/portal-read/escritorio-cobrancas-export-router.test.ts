import express from "express";
import { describe, expect, it, vi, beforeEach } from "vitest";
import request from "supertest";
import { signAccessToken } from "../../src/modules/identity-access/application/jwt-service";
import { createEscritorioRouter } from "../../src/modules/portal-read/interfaces/http/escritorio-router";

const { automacaoTenantId, publicTenantId } = vi.hoisted(() => ({
  automacaoTenantId: "tenant-automacao-esc",
  publicTenantId: "00000000-0000-4000-8000-000000000001"
}));

vi.mock("../../src/modules/portal-read/infrastructure/billing-tenant-link-repository", () => ({
  getPublicTenantIdForAutomacao: vi.fn().mockResolvedValue(publicTenantId)
}));

vi.mock("../../src/platform/persistence/with-tenant-transaction", () => ({
  withTenantTransaction: vi.fn(async (_tid: string, fn: (c: unknown) => unknown) => fn({ query: vi.fn() }))
}));

const streamMock = vi.hoisted(() => vi.fn());

vi.mock("../../src/modules/portal-read/application/escritorio-cobrancas-export", async (importOriginal) => {
  const mod = await importOriginal<
    typeof import("../../src/modules/portal-read/application/escritorio-cobrancas-export")
  >();
  return {
    ...mod,
    streamCobrancasCsvRows: streamMock
  };
});

function buildApp(role: "admin_escritorio" | "operador") {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.tenantContext = { tenantId: automacaoTenantId };
    process.env.JWT_SECRET = "csv-export-router-secret";
    const token = signAccessToken({
      sub: "user-1",
      tid: automacaoTenantId,
      roles: ["owner"]
    });
    req.headers.authorization = `Bearer ${token}`;
    req.authContext = {
      userId: "user-1",
      tenantId: automacaoTenantId,
      roles: ["owner"]
    };
    req.portalMembership = { role, cpfCnpjCliente: null };
    next();
  });
  app.use("/v1/portal/escritorio", createEscritorioRouter());
  return app;
}

describe("GET /v1/portal/escritorio/cobrancas/export", () => {
  beforeEach(() => {
    streamMock.mockReset();
    process.env.JWT_SECRET = "csv-export-router-secret";
  });

  it("retorna text/csv com header na primeira linha", async () => {
    async function* gen() {
      yield "id,created_at,due_date,paid_at,canonical_status,amount,description,type,cliente_nome,cliente_documento_mascarado,boleto_barcode,gateway_transaction_id\n";
      yield "row1\n";
    }
    streamMock.mockReturnValue(gen());

    const app = buildApp("admin_escritorio");
    const res = await request(app)
      .get("/v1/portal/escritorio/cobrancas/export")
      .query({ format: "csv" })
      .expect(200);

    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["content-disposition"]).toMatch(/attachment; filename="cobrancas-/);
    const firstLine = res.text.split("\n")[0];
    expect(firstLine).toContain("cliente_documento_mascarado");
    expect(firstLine.startsWith("id,")).toBe(true);
  });

  it("format ausente → 400", async () => {
    const app = buildApp("admin_escritorio");
    await request(app).get("/v1/portal/escritorio/cobrancas/export").expect(400);
    expect(streamMock).not.toHaveBeenCalled();
  });

  it("operador → 403", async () => {
    const app = buildApp("operador");
    await request(app)
      .get("/v1/portal/escritorio/cobrancas/export")
      .query({ format: "csv" })
      .expect(403);
    expect(streamMock).not.toHaveBeenCalled();
  });
});
