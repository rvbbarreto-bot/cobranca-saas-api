import type { CanonicalChargeStatus } from "../../billing-core/domain/charge";

/** Eventos de webhook Asaas → canonical_status. */
export const ASAAS_WEBHOOK_EVENT_TO_CANONICAL: Record<string, CanonicalChargeStatus> = {
  PAYMENT_CREATED: "pendente_pagamento",
  PAYMENT_UPDATED: "pendente_pagamento",
  PAYMENT_CONFIRMED: "paga",
  PAYMENT_RECEIVED: "paga",
  PAYMENT_OVERDUE: "vencida",
  PAYMENT_DELETED: "cancelada",
  PAYMENT_RESTORED: "emitida",
  PAYMENT_REFUNDED: "cancelada"
};

/** Campo payment.status da API Asaas → canonical_status. */
export const ASAAS_PAYMENT_STATUS_TO_CANONICAL: Record<string, CanonicalChargeStatus> = {
  PENDING: "pendente_pagamento",
  RECEIVED: "paga",
  CONFIRMED: "paga",
  OVERDUE: "vencida",
  REFUNDED: "cancelada",
  DELETED: "cancelada"
};

/** @deprecated use mapAsaasWebhookEvent ou mapAsaasPaymentFieldStatus */
export const ASAAS_TO_CANONICAL = ASAAS_WEBHOOK_EVENT_TO_CANONICAL;

export function mapAsaasWebhookEvent(event: string): CanonicalChargeStatus | undefined {
  return ASAAS_WEBHOOK_EVENT_TO_CANONICAL[event.trim().toUpperCase()];
}

export function mapAsaasPaymentFieldStatus(status: string): CanonicalChargeStatus | undefined {
  return ASAAS_PAYMENT_STATUS_TO_CANONICAL[status.trim().toUpperCase()];
}

export function mapAsaasPaymentStatus(asaasStatus: string): CanonicalChargeStatus | undefined {
  return mapAsaasWebhookEvent(asaasStatus) ?? mapAsaasPaymentFieldStatus(asaasStatus);
}