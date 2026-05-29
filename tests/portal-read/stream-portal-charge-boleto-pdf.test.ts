import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PoolClient } from "pg";
import {
  chargeHasInterPdfProxy,
  streamPortalChargeBoletoPdfUseCase
} from "../../src/modules/portal-read/application/stream-portal-charge-boleto-pdf";
import { InterAdapter } from "../../src/modules/payment-gateway/infrastructure/inter/inter-adapter";

const getChargeWithLatestPayment = vi.fn();
const getGatewayForTenant = vi.fn();

vi.mock("../../src/modules/billing-core/infrastructure/charge-repository", () => ({
  getChargeWithLatestPayment: (...args: unknown[]) => getChargeWithLatestPayment(...args)
}));

vi.mock("../../src/modules/payment-gateway/application/get-gateway-for-tenant", () => ({
  getGatewayForTenant: (...args: unknown[]) => getGatewayForTenant(...args)
}));

describe("streamPortalChargeBoletoPdfUseCase", () => {
  const client = {} as PoolClient;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("chargeHasInterPdfProxy detecta placeholder inter://", () => {
    expect(
      chargeHasInterPdfProxy({
        boleto_pdf_url: "inter://cobranca/cod-1/pdf",
        boleto_url: null
      })
    ).toBe(true);
    expect(
      chargeHasInterPdfProxy({
        boleto_pdf_url: "https://x.com/a.pdf",
        boleto_url: null
      })
    ).toBe(false);
  });

  it("retorna not_found quando cobranca inexistente", async () => {
    getChargeWithLatestPayment.mockResolvedValue(null);
    const result = await streamPortalChargeBoletoPdfUseCase(client, "charge-1", "tenant-1");
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  it("retorna not_inter quando gateway nao e Inter", async () => {
    getChargeWithLatestPayment.mockResolvedValue({
      charge: { reference: "REF-1" },
      payment: {
        gateway: "asaas",
        gateway_transaction_id: "pay-1",
        boleto_pdf_url: "inter://cobranca/cod-1/pdf",
        boleto_url: null
      }
    });
    getGatewayForTenant.mockResolvedValue({ provider: "asaas" });

    const result = await streamPortalChargeBoletoPdfUseCase(client, "charge-1", "tenant-1");
    expect(result).toEqual({ ok: false, reason: "not_inter" });
  });

  it("baixa PDF quando gateway e InterAdapter", async () => {
    const downloadBoletoPdf = vi.fn().mockResolvedValue(Buffer.from("%PDF-1.4"));
    const interAdapter = new InterAdapter({
      tenantId: "tenant-1",
      provider: "inter",
      sandbox: true,
      credentials: {
        client_id: "cid",
        client_secret: "sec",
        certificate_pem: "cert",
        private_key_pem: "key"
      }
    });
    vi.spyOn(interAdapter, "downloadBoletoPdf").mockImplementation(downloadBoletoPdf);

    getChargeWithLatestPayment.mockResolvedValue({
      charge: { reference: "REF-1" },
      payment: {
        gateway: "inter",
        gateway_transaction_id: "cod-inter-1",
        boleto_pdf_url: "inter://cobranca/cod-inter-1/pdf",
        boleto_url: null
      }
    });
    getGatewayForTenant.mockResolvedValue(interAdapter);

    const result = await streamPortalChargeBoletoPdfUseCase(client, "charge-1", "tenant-1");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.buffer.toString()).toContain("%PDF");
      expect(downloadBoletoPdf).toHaveBeenCalledWith("cod-inter-1");
    }
  });
});
