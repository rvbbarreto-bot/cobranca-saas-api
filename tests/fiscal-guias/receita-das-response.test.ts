import { describe, expect, it } from "vitest";
import { parseReceitaDasCaptureResponse } from "../../src/modules/fiscal-guias/infrastructure/receita/receita-das-response";

describe("parseReceitaDasCaptureResponse", () => {
  it("mapeia resposta JSON do gateway Receita DAS", () => {
    const pdf = Buffer.from("fake-pdf").toString("base64");
    const result = parseReceitaDasCaptureResponse({
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
});
