import { describe, expect, it, vi, beforeEach } from "vitest";
import { C6BankAdapter } from "../../src/modules/payment-gateway/infrastructure/c6/c6-adapter";
import type { GatewayAdapterContext } from "../../src/modules/payment-gateway/domain/gateway-types";

vi.mock("../../src/modules/payment-gateway/infrastructure/c6/c6-http-client", () => ({
  C6HttpClient: vi.fn()
}));

import { C6HttpClient } from "../../src/modules/payment-gateway/infrastructure/c6/c6-http-client";

const ctx: GatewayAdapterContext = {
  tenantId: "t1",
  provider: "c6",
  sandbox: true,
  credentials: {
    client_id: "cid",
    client_secret: "sec",
    codigo_cedente: "123",
    agencia: "0001",
    conta: "123456",
    modalidade: "1"
  }
};

describe("C6BankAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createBoleto mapeia id da resposta", async () => {
    const requestJson = vi.fn().mockResolvedValue({
      id: "c6-boleto-1",
      codigoBarras: "336",
      linhaDigitavel: "33600",
      situacao: "PENDENTE"
    });
    vi.mocked(C6HttpClient).mockImplementation(
      () => ({ requestJson }) as unknown as C6HttpClient
    );

    const adapter = new C6BankAdapter(ctx);
    const customerId = await adapter.createCustomer({
      name: "Joao",
      cpfCnpj: "11122233344",
      email: "a@b.com",
      externalReference: "c1"
    });

    const result = await adapter.createBoleto({
      gatewayCustomerId: customerId,
      value: 100,
      dueDate: "2030-01-15",
      description: "Ref",
      externalReference: "idem-1",
      payer: {
        name: "Joao",
        cpfCnpj: "11122233344",
        email: "a@b.com",
        externalReference: "c1",
        endereco: {
          cep: "01310100",
          logradouro: "Av Paulista",
          bairro: "Bela Vista",
          cidade: "Sao Paulo",
          uf: "SP"
        }
      }
    });

    expect(result.gatewayTransactionId).toBe("c6-boleto-1");
    expect(requestJson).toHaveBeenCalledWith("POST", expect.stringContaining("boletos"), expect.any(Object));
  });
});
