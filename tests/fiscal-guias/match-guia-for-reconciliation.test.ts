import { describe, expect, it } from "vitest";
import {
  matchGuiaForReconciliation,
  type GuiaReconciliationCandidate
} from "../../src/modules/fiscal-guias/domain/match-guia-for-reconciliation";

const guia = (overrides: Partial<GuiaReconciliationCandidate> = {}): GuiaReconciliationCandidate => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  status: "DISPONIVEL",
  valorTotal: 250,
  linhaDigitavel: "34191.79001 01043.510047 91020.150008 8 84410026000",
  ...overrides
});

describe("matchGuiaForReconciliation", () => {
  it("match por guia_fiscal_id com valor exato", () => {
    const r = matchGuiaForReconciliation({
      guiaFiscalId: guia().id,
      valorPago: 250,
      candidates: [guia()]
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.guiaId).toBe(guia().id);
    }
  });

  it("match por linha_digitavel normalizada", () => {
    const r = matchGuiaForReconciliation({
      linhaDigitavel: "34191790010104351004791020150008884410026000",
      valorPago: 250,
      candidates: [guia()]
    });
    expect(r.ok).toBe(true);
  });

  it("rejeita valor divergente", () => {
    const r = matchGuiaForReconciliation({
      guiaFiscalId: guia().id,
      valorPago: 999,
      candidates: [guia()]
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("valor_mismatch");
  });

  it("rejeita multiplas guias com mesma linha", () => {
    const r = matchGuiaForReconciliation({
      linhaDigitavel: guia().linhaDigitavel!,
      valorPago: 250,
      candidates: [guia(), guia({ id: "660e8400-e29b-41d4-a716-446655440001" })]
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("guia_ambiguous");
  });

  it("ignora guias ja pagas", () => {
    const r = matchGuiaForReconciliation({
      guiaFiscalId: guia().id,
      valorPago: 250,
      candidates: [guia({ status: "PAGO" })]
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("guia_not_found");
  });
});
