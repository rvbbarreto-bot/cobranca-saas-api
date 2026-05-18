import type { CanonicalChargeStatus } from "../domain/charge";

/**
 * Transicoes permitidas de status canonicos (cobranca).
 * Estados terminais: `paga`, `cancelada` — apenas noop (mesmo status) via webhook.
 */
const ALLOWED: Record<CanonicalChargeStatus, ReadonlySet<CanonicalChargeStatus>> = {
  rascunho: new Set(["emitida", "cancelada"]),
  emitida: new Set(["enviada", "pendente_pagamento", "paga", "vencida", "cancelada", "erro_emissao"]),
  enviada: new Set(["pendente_pagamento", "paga", "vencida", "cancelada"]),
  pendente_pagamento: new Set(["paga", "vencida", "cancelada"]),
  vencida: new Set(["paga", "cancelada"]),
  paga: new Set(),
  cancelada: new Set(["emitida"]),
  erro_emissao: new Set(["emitida", "cancelada"])
};

export type ChargeTransitionDecision = "allow" | "noop" | "deny";

export function evaluateChargeStatusTransition(
  from: CanonicalChargeStatus,
  to: CanonicalChargeStatus
): ChargeTransitionDecision {
  if (from === to) {
    return "noop";
  }
  const set = ALLOWED[from];
  if (set?.has(to)) {
    return "allow";
  }
  return "deny";
}
