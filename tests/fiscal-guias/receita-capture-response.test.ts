import { describe, expect, it } from "vitest";
import { parseReceitaCaptureResponse } from "../../src/modules/fiscal-guias/infrastructure/receita/receita-capture-response";

describe("parseReceitaCaptureResponse (DAS/DARF)", () => {
  it("mapeia resposta JSON do gateway Receita DAS", () => {
    const pdf = Buffer.from("fake-pdf").toString("base64");
    const result = parseReceitaCaptureResponse({
      valor_principal: 250.5,
      valor_multa: 10,
      valor_juros: 5,
      data_vencimento: "2026-06-20",
      linha_digitavel: "85800000000150012340201234567890123456789012345",
      pix_copia_cola: "00020126580014br.gov.bcb.pix",
      pdf_base64: pdf,
      compliance_status: "aprovado"
    });

    expect(result.valorPrincipal).toBe(250.5);
    expect(result.pdfBytes?.toString()).toBe("fake-pdf");
    expect(result.complianceStatus).toBe("aprovado");
  });

  it("mapeia resposta JSON do gateway Receita DARF", () => {
    const result = parseReceitaCaptureResponse({
      valor_principal: 420,
      data_vencimento: "2026-07-31",
      linha_digitavel: "85600000000420012340201234567890123456789012345",
      compliance_status: "aprovado"
    });

    expect(result.valorPrincipal).toBe(420);
    expect(result.valorMulta).toBe(0);
    expect(result.linhaDigitavel.startsWith("856")).toBe(true);
  });
});
