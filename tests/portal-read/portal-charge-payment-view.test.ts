import { describe, expect, it } from "vitest";
import { mapChargePaymentForPortal } from "../../src/modules/portal-read/application/portal-charge-payment-view";

describe("mapChargePaymentForPortal", () => {
  it("substitui placeholder inter por path do portal", () => {
    const mapped = mapChargePaymentForPortal(
      {
        type: "boleto",
        boleto_url: "inter://cobranca/cod-1/pdf",
        boleto_pdf_url: "inter://cobranca/cod-1/pdf",
        boleto_barcode: "123",
        pix_qrcode_base64: null,
        pix_emv: null,
        pix_link: null,
        expires_at: null,
        gateway: "inter",
        gateway_transaction_id: "cod-1"
      },
      "charge-uuid"
    );
    expect(mapped?.boleto_pdf_url).toBe("/v1/portal/cobrancas/charge-uuid/boleto.pdf");
    expect(mapped).not.toHaveProperty("gateway");
    expect(mapped).not.toHaveProperty("gateway_transaction_id");
  });
});
