import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AsaasAdapter } from "../../src/modules/payment-gateway/infrastructure/asaas/asaas-adapter";
import { mapAsaasPaymentStatus } from "../../src/modules/payment-gateway/domain/asaas-status-map";

const config = {
  apiKey: "test_key",
  baseUrl: "https://sandbox.asaas.com/api/v3"
};

describe("AsaasAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => "{}"
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("createCustomer envia POST /customers e retorna id", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => JSON.stringify({ id: "cus_123" })
    } as Response);

    const adapter = new AsaasAdapter(config);
    const id = await adapter.createCustomer({
      name: "Cliente Teste",
      cpfCnpj: "123.456.789-09",
      email: "a@b.com",
      externalReference: "portal-uuid"
    });

    expect(id).toBe("cus_123");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://sandbox.asaas.com/api/v3/customers",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ access_token: "test_key" })
      })
    );
  });

  it("createBoleto envia billingType BOLETO", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () =>
          JSON.stringify({
            id: "pay_boleto",
            bankSlipUrl: "https://boleto",
            invoiceUrl: "https://pdf",
            barCode: "123",
            identificationField: "linha",
            nossoNumero: "NN1"
          })
      } as Response);

    const adapter = new AsaasAdapter(config);
    const out = await adapter.createBoleto({
      gatewayCustomerId: "cus_1",
      value: 99.9,
      dueDate: "2030-12-31",
      description: "Mensalidade",
      externalReference: "idem-key-12345678"
    });

    expect(out.gatewayTransactionId).toBe("pay_boleto");
    expect(out.boletoUrl).toBe("https://boleto");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.billingType).toBe("BOLETO");
    expect(body.fine).toEqual({ value: 2 });
  });

  it("createPix consulta pixQrCode apos criar pagamento", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () => JSON.stringify({ id: "pay_pix", invoiceUrl: "https://inv" })
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        text: async () =>
          JSON.stringify({
            encodedImage: "base64img",
            payload: "00020126",
            expirationDate: "2030-12-31T12:00:00Z"
          })
      } as Response);

    const adapter = new AsaasAdapter(config);
    const out = await adapter.createPix({
      gatewayCustomerId: "cus_1",
      value: 50,
      dueDate: "2030-12-31",
      description: "PIX",
      externalReference: "idem-pix-12345678"
    });

    expect(out.pixEmv).toBe("00020126");
    expect(out.pixQrcodeBase64).toBe("base64img");
    expect(String(fetchMock.mock.calls[1][0])).toContain("/payments/pay_pix/pixQrCode");
  });

  it("cancelCharge usa DELETE /payments/:id", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => ""
    } as Response);

    const adapter = new AsaasAdapter(config);
    await adapter.cancelCharge("pay_99");
    expect(fetchMock.mock.calls[0][0]).toBe("https://sandbox.asaas.com/api/v3/payments/pay_99");
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "DELETE" });
  });
});

describe("mapAsaasPaymentStatus", () => {
  it("mapeia PAYMENT_RECEIVED para paga", () => {
    expect(mapAsaasPaymentStatus("PAYMENT_RECEIVED")).toBe("paga");
  });
});
