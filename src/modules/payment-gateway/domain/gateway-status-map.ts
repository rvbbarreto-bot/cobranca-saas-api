import type { CanonicalChargeStatus } from "../../billing-core/domain/charge";
import { mapAsaasPaymentStatus } from "./asaas-status-map";

const INTER_STATUS_TO_CANONICAL: Record<string, CanonicalChargeStatus> = {
  EM_ABERTO: "pendente_pagamento",
  EM_PROCESSAMENTO: "emitida",
  PAGO: "paga",
  CANCELADO: "cancelada",
  VENCIDO: "vencida",
  EXPIRADO: "vencida"
};

const C6_STATUS_TO_CANONICAL: Record<string, CanonicalChargeStatus> = {
  PENDENTE: "pendente_pagamento",
  EMITIDO: "emitida",
  PAGO: "paga",
  LIQUIDADO: "paga",
  CANCELADO: "cancelada",
  VENCIDO: "vencida"
};

const CORA_STATUS_TO_CANONICAL: Record<string, CanonicalChargeStatus> = {
  PENDING: "pendente_pagamento",
  PAID: "paga",
  CANCELLED: "cancelada",
  CANCELED: "cancelada",
  OVERDUE: "vencida",
  EXPIRED: "vencida"
};

export function mapInterChargeStatus(status: string): CanonicalChargeStatus | undefined {
  return INTER_STATUS_TO_CANONICAL[status.trim().toUpperCase()];
}

export function mapCoraChargeStatus(status: string): CanonicalChargeStatus | undefined {
  return CORA_STATUS_TO_CANONICAL[status.trim().toUpperCase()];
}

export function mapC6ChargeStatus(status: string): CanonicalChargeStatus | undefined {
  return C6_STATUS_TO_CANONICAL[status.trim().toUpperCase()];
}

export function mapGatewayChargeStatus(
  provider: string,
  gatewayStatus: string
): CanonicalChargeStatus | undefined {
  const p = provider.trim().toLowerCase();
  if (p === "inter") {
    return mapInterChargeStatus(gatewayStatus);
  }
  if (p === "cora") {
    return mapCoraChargeStatus(gatewayStatus);
  }
  if (p === "c6") {
    return mapC6ChargeStatus(gatewayStatus);
  }
  return mapAsaasPaymentStatus(gatewayStatus);
}
