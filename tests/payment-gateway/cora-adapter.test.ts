import { describe, expect, it, vi, beforeEach } from "vitest";
import { CoraAdapter } from "../../src/modules/payment-gateway/infrastructure/cora/cora-adapter";
import type { GatewayAdapterContext } from "../../src/modules/payment-gateway/domain/gateway-types";

vi.mock("../../src/modules/payment-gateway/infrastructure/cora/cora-http-client", () => ({
  CoraHttpClient: vi.fn()
}));

vi.mock("../../src/platform/payment-gateway/mtls-agent", () => ({
  buildMtlsAgent: vi.fn(() => ({}))
}));

import { CoraHttpClient } from "../../src/modules/payment-gateway/infrastructure/cora/cora-http-client";

const ctx: GatewayAdapterContext = {
  tenantId: "t1",
  provider: "cora",
  sandbox: true,
  credentials: {
    client_id: "cid",
    certificate_pem: "cert",
    private_key_pem: "key"
  }
};

describe("CoraAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createBoleto converte valor para centavos no payload", async () => {
    const requestJson = vi.fn().mockResolvedValue({
      id: "inv-1",
      status: "PENDING",
      bank_slip: { url: "https://boleto", barcode: "033", type_full_code: "03300" }
    });
    vi.mocked(CoraHttpClient).mockImplementation(
      () => ({ requestJson }) as unknown as CoraHttpClient
    );

    const adapter = new CoraAdapter(ctx);
    const customerId = await adapter.createCustomer({
      name: "Empresa",
      cpfCnpj: "34052649000178",
      email: "a@b.com",
      externalReference: "c1"
    });

    const result = await adapter.createBoleto({
      gatewayCustomerId: customerId,
      value: 250,
      dueDate: "2030-06-15",
      description: "Mensalidade",
      externalReference: "code-1"
    });

    expect(result.gatewayTransactionId).toBe("inv-1");
    const payload = requestJson.mock.calls[0]?.[2] as { services: Array<{ amount: number }> };
    expect(payload.services[0].amount).toBe(25000);
  });
});
