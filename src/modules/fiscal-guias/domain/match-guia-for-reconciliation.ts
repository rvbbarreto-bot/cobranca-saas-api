import type { GuiaFiscalStatus } from "./schemas/guia-fiscal.schema";
import { normalizeLinhaDigitavel } from "./schemas/fiscal-guia-reconciliation.schema";

export type GuiaReconciliationCandidate = {
  id: string;
  status: GuiaFiscalStatus;
  valorTotal: number;
  linhaDigitavel?: string | null;
};

export type MatchGuiaForReconciliationInput = {
  guiaFiscalId?: string;
  linhaDigitavel?: string;
  valorPago: number;
  candidates: GuiaReconciliationCandidate[];
};

export type MatchGuiaForReconciliationResult =
  | { ok: true; guiaId: string; previousStatus: GuiaFiscalStatus }
  | { ok: false; reason: "guia_not_found" | "guia_ambiguous" | "valor_mismatch" | "transition_denied" };

const PAYABLE_STATUSES: GuiaFiscalStatus[] = ["DISPONIVEL", "VENCIDO"];

function valoresCoincidem(valorPago: number, valorTotal: number): boolean {
  return Math.abs(valorPago - valorTotal) <= 0.01;
}

export function matchGuiaForReconciliation(
  input: MatchGuiaForReconciliationInput
): MatchGuiaForReconciliationResult {
  let matched: GuiaReconciliationCandidate[] = input.candidates;

  if (input.guiaFiscalId?.trim()) {
    const guiaId = input.guiaFiscalId.trim();
    matched = matched.filter((c) => c.id === guiaId);
  } else if (input.linhaDigitavel?.trim()) {
    const normalized = normalizeLinhaDigitavel(input.linhaDigitavel);
    matched = matched.filter((c) => {
      const candidateDigits = normalizeLinhaDigitavel(c.linhaDigitavel ?? "");
      return candidateDigits.length > 0 && candidateDigits === normalized;
    });
  }

  matched = matched.filter((c) => PAYABLE_STATUSES.includes(c.status));

  if (matched.length === 0) {
    return { ok: false, reason: "guia_not_found" };
  }
  if (matched.length > 1) {
    return { ok: false, reason: "guia_ambiguous" };
  }

  const guia = matched[0]!;
  if (!valoresCoincidem(input.valorPago, guia.valorTotal)) {
    return { ok: false, reason: "valor_mismatch" };
  }

  return { ok: true, guiaId: guia.id, previousStatus: guia.status };
}
