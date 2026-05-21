import type { SubscriptionStatus } from "../domain/subscription-status";

const ASAAS_SUBSCRIPTION_STATUS: Record<string, SubscriptionStatus> = {
  ACTIVE: "active",
  EXPIRED: "suspended",
  INACTIVE: "suspended"
};

const ASAAS_SUBSCRIPTION_EVENTS: Record<string, SubscriptionStatus> = {
  SUBSCRIPTION_DELETED: "canceled",
  SUBSCRIPTION_INACTIVATED: "suspended",
  SUBSCRIPTION_UPDATED: "active"
};

const ASAAS_SUBSCRIPTION_PAYMENT_EVENTS: Record<string, SubscriptionStatus> = {
  PAYMENT_RECEIVED: "active",
  PAYMENT_CONFIRMED: "active",
  PAYMENT_OVERDUE: "past_due"
};

export function mapAsaasSubscriptionFieldStatus(status: string | undefined): SubscriptionStatus | undefined {
  if (!status?.trim()) {
    return undefined;
  }
  return ASAAS_SUBSCRIPTION_STATUS[status.trim().toUpperCase()];
}

export function mapAsaasSubscriptionWebhookEvent(event: string): SubscriptionStatus | undefined {
  const key = event.trim().toUpperCase();
  return ASAAS_SUBSCRIPTION_EVENTS[key] ?? ASAAS_SUBSCRIPTION_PAYMENT_EVENTS[key];
}
