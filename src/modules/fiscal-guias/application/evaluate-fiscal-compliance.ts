import type { ReceitaDasCaptureResult, ReceitaDasComplianceStatus } from "../domain/receita-gateway.interface";
import { canDisponibilizarGuia } from "../domain/guia-fiscal-status-transition";

export type FiscalComplianceDecision = {
  status: ReceitaDasComplianceStatus;
  motivo: string | null;
  canDisponibilizar: boolean;
};

function parseMaxValor(): number | null {
  const raw = process.env.FISCAL_COMPLIANCE_MAX_VALOR?.trim();
  if (!raw) {
    return null;
  }
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Avalia compliance pos-captura. Usa status do gateway quando presente;
 * caso contrario aplica regras basicas (valor maximo configuravel).
 */
export function evaluateFiscalCompliance(capture: ReceitaDasCaptureResult): FiscalComplianceDecision {
  if (capture.complianceStatus && capture.complianceStatus !== "pendente") {
    return {
      status: capture.complianceStatus,
      motivo: capture.complianceMotivo ?? null,
      canDisponibilizar: canDisponibilizarGuia(capture.complianceStatus)
    };
  }

  const total =
    capture.valorPrincipal + (capture.valorMulta ?? 0) + (capture.valorJuros ?? 0);
  const maxValor = parseMaxValor();
  if (maxValor != null && total > maxValor) {
    return {
      status: "bloqueado",
      motivo: `Valor total ${total.toFixed(2)} excede limite ${maxValor.toFixed(2)}.`,
      canDisponibilizar: false
    };
  }

  if (!capture.linhaDigitavel?.trim()) {
    return {
      status: "bloqueado",
      motivo: "Linha digitavel ausente na captura.",
      canDisponibilizar: false
    };
  }

  return {
    status: "aprovado",
    motivo: null,
    canDisponibilizar: true
  };
}
