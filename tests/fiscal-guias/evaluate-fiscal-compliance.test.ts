import { describe, expect, it } from "vitest";
import { evaluateFiscalCompliance } from "../../src/modules/fiscal-guias/application/evaluate-fiscal-compliance";

describe("evaluateFiscalCompliance", () => {
  it("aprova captura valida sem status do gateway", () => {
    const decision = evaluateFiscalCompliance({
      valorPrincipal: 150,
      valorMulta: 0,
      valorJuros: 0,
      dataVencimento: "2026-06-20",
      linhaDigitavel: "85800000000150012340201234567890123456789012345"
    });
    expect(decision.status).toBe("aprovado");
    expect(decision.canDisponibilizar).toBe(true);
  });

  it("bloqueia quando gateway retorna bloqueado", () => {
    const decision = evaluateFiscalCompliance({
      valorPrincipal: 150,
      valorMulta: 0,
      valorJuros: 0,
      dataVencimento: "2026-06-20",
      linhaDigitavel: "85800000000150012340201234567890123456789012345",
      complianceStatus: "bloqueado",
      complianceMotivo: "Divergencia cadastral"
    });
    expect(decision.canDisponibilizar).toBe(false);
    expect(decision.motivo).toBe("Divergencia cadastral");
  });

  it("bloqueia valor acima do limite configurado", () => {
    const prev = process.env.FISCAL_COMPLIANCE_MAX_VALOR;
    process.env.FISCAL_COMPLIANCE_MAX_VALOR = "100";
    try {
      const decision = evaluateFiscalCompliance({
        valorPrincipal: 150,
        valorMulta: 0,
        valorJuros: 0,
        dataVencimento: "2026-06-20",
        linhaDigitavel: "85800000000150012340201234567890123456789012345"
      });
      expect(decision.status).toBe("bloqueado");
      expect(decision.canDisponibilizar).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.FISCAL_COMPLIANCE_MAX_VALOR;
      else process.env.FISCAL_COMPLIANCE_MAX_VALOR = prev;
    }
  });
});
