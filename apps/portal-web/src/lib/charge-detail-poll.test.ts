import { describe, expect, it } from "vitest";
import { shouldPollChargeDetail } from "./charge-detail-poll";

describe("shouldPollChargeDetail", () => {
  it("polla sem dados iniciais", () => {
    expect(shouldPollChargeDetail(undefined)).toBe(true);
  });

  it("polla em rascunho sem payment", () => {
    expect(
      shouldPollChargeDetail({
        charge: { id: "1", reference: "r", amount: "1", dueDate: "2030-01-01", canonicalStatus: "rascunho" },
        payment: null
      })
    ).toBe(true);
  });

  it("para quando payment existe", () => {
    expect(
      shouldPollChargeDetail({
        charge: { id: "1", reference: "r", amount: "1", dueDate: "2030-01-01", canonicalStatus: "emitida" },
        payment: {
          type: "pix",
          boleto_url: null,
          boleto_pdf_url: null,
          boleto_barcode: null,
          pix_qrcode_base64: "x",
          pix_emv: "y",
          pix_link: null,
          expires_at: null
        }
      })
    ).toBe(false);
  });

  it("para em erro_emissao", () => {
    expect(
      shouldPollChargeDetail({
        charge: { id: "1", reference: "r", amount: "1", dueDate: "2030-01-01", canonicalStatus: "erro_emissao" },
        payment: null
      })
    ).toBe(false);
  });
});
