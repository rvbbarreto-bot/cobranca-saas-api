import type { GuiaFiscalStatus } from "./schemas/guia-fiscal.schema";

/**
 * Transições permitidas de status de guia fiscal.
 * Terminais: PAGO, CANCELADO — apenas noop (mesmo status).
 */
const ALLOWED: Record<GuiaFiscalStatus, ReadonlySet<GuiaFiscalStatus>> = {
  PROCESSANDO: new Set(["DISPONIVEL", "CANCELADO"]),
  DISPONIVEL: new Set(["PAGO", "VENCIDO", "EM_CONTESTACAO", "CANCELADO"]),
  VENCIDO: new Set(["PAGO", "EM_CONTESTACAO", "CANCELADO"]),
  EM_CONTESTACAO: new Set(["DISPONIVEL", "CANCELADO", "RETIFICADO"]),
  RETIFICADO: new Set(["PROCESSANDO", "DISPONIVEL", "CANCELADO"]),
  PAGO: new Set(),
  CANCELADO: new Set()
};

export type GuiaFiscalTransitionDecision = "allow" | "noop" | "deny";

export function evaluateGuiaFiscalStatusTransition(
  from: GuiaFiscalStatus,
  to: GuiaFiscalStatus
): GuiaFiscalTransitionDecision {
  if (from === to) {
    return "noop";
  }
  const set = ALLOWED[from];
  if (set?.has(to)) {
    return "allow";
  }
  return "deny";
}

/**
 * Regra de negócio (critério aceite): só permite DISPONIVEL se compliance aprovado/dispensado.
 */
export function canDisponibilizarGuia(complianceStatus: string): boolean {
  return complianceStatus === "aprovado" || complianceStatus === "dispensado";
}
