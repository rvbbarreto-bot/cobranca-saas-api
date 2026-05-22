import { describe, expect, it, vi, beforeEach } from "vitest";
import { InterAdapter } from "../../src/modules/payment-gateway/infrastructure/inter/inter-adapter";
import type { GatewayAdapterContext } from "../../src/modules/payment-gateway/domain/gateway-types";

vi.mock("../../src/modules/payment-gateway/infrastructure/inter/inter-http-client", () => {
  return {
    InterHttpClient: vi.fn().mockImplementation(() => ({
      requestJson: vi.fn()
    }))
  };
});

vi.mock("../../src/platform/payment-gateway/mtls-agent", () => ({
  buildMtlsAgent: vi.fn(() => ({}))
}));

import { InterHttpClient } from "../../src/modules/payment-gateway/infrastructure/inter/inter-http-client";

const ctx: GatewayAdapterContext = {
  tenantId: "t1",
  provider: "inter",
  sandbox: true,
  credentials: {
    client_id: "cid",
    client_secret: "sec",
    certificate_pem: "cert",
    private_key_pem: "key"
  }
};

describe("InterAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createBoleto mapeia codigoSolicitacao", async () => {
    const requestJson = vi.fn().mockResolvedValue({
      codigoSolicitacao: "uuid-inter-1",
      situacao: "EM_ABERTO",
      codigoBarras: "077",
      linhaDigitavel: "07700",
      nossoNumero: "123"
    });
    vi.mocked(InterHttpClient).mockImplementation(
      () => ({ requestJson }) as unknown as InterHttpClient
    );

    const adapter = new InterAdapter(ctx);
    const customerId = await adapter.createCustomer({
      name: "Joao",
      cpfCnpj: "11122233344",
      email: "a@b.com",
      externalReference: "cli-1"
    });

    const result = await adapter.createBoleto({
      gatewayCustomerId: customerId,
      value: 100,
      dueDate: "2030-01-15",
      description: "Ref",
      externalReference: "idem-1"
    });

    expect(result.gatewayTransactionId).toBe("uuid-inter-1");
    expect(result.barCode).toBe("077");
  });

  it("createPix retorna not_supported", async () => {
    vi.mocked(InterHttpClient).mockImplementation(
      () => ({ requestJson: vi.fn() }) as unknown as InterHttpClient
    );
    const adapter = new InterAdapter(ctx);
    await expect(
      adapter.createPix({
        gatewayCustomerId: "inter:1",
        value: 10,
        dueDate: "2030-01-15",
        description: "x",
        externalReference: "x"
      })
    ).rejects.toMatchObject({ code: "not_supported" });
  });
});
