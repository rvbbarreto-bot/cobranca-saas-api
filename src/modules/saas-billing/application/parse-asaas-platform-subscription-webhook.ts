import { z } from "zod";
import {
  mapAsaasSubscriptionFieldStatus,
  mapAsaasSubscriptionWebhookEvent
} from "./asaas-subscription-status-map";
import type { SubscriptionStatus } from "../domain/subscription-status";

const subscriptionSchema = z.object({
  id: z.string().min(1),
  status: z.string().optional(),
  externalReference: z.string().optional()
});

const paymentSchema = z.object({
  id: z.string().min(1),
  subscription: z.string().optional(),
  externalReference: z.string().optional(),
  status: z.string().optional()
});

const webhookSchema = z.object({
  event: z.string().min(1),
  subscription: subscriptionSchema.optional(),
  payment: paymentSchema.optional()
});

export type PlatformSubscriptionWebhookContext = {
  event: string;
  gatewaySubscriptionId: string;
  tenantIdHint: string | null;
  newStatus: SubscriptionStatus;
};

function resolveStatus(event: string, subscriptionStatus?: string, paymentStatus?: string): SubscriptionStatus | undefined {
  const fromEvent = mapAsaasSubscriptionWebhookEvent(event);
  if (fromEvent) {
    return fromEvent;
  }
  return (
    mapAsaasSubscriptionFieldStatus(subscriptionStatus) ??
    mapAsaasSubscriptionFieldStatus(paymentStatus)
  );
}

function extractTenantId(externalReference?: string, paymentExternalReference?: string): string | null {
  const ref = externalReference?.trim() || paymentExternalReference?.trim() || "";
  if (!ref) {
    return null;
  }
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRe.test(ref) ? ref : null;
}

export function parseAsaasPlatformSubscriptionWebhook(payload: unknown):
  | { ok: true; value: PlatformSubscriptionWebhookContext }
  | { ok: false; issues: string[] } {
  const parsed = webhookSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
    };
  }

  const event = parsed.data.event.trim().toUpperCase();
  const sub = parsed.data.subscription;
  const pay = parsed.data.payment;

  const gatewaySubscriptionId = sub?.id?.trim() || pay?.subscription?.trim();
  if (!gatewaySubscriptionId) {
    return { ok: false, issues: ["subscription.id ou payment.subscription obrigatorio"] };
  }

  const newStatus = resolveStatus(event, sub?.status, pay?.status);
  if (!newStatus) {
    return { ok: false, issues: [`evento de assinatura SaaS nao mapeado: ${event}`] };
  }

  const tenantIdHint = extractTenantId(sub?.externalReference, pay?.externalReference);

  return {
    ok: true,
    value: {
      event,
      gatewaySubscriptionId,
      tenantIdHint,
      newStatus
    }
  };
}

export function isLikelyPlatformSubscriptionWebhook(payload: unknown): boolean {
  const parsed = webhookSchema.safeParse(payload);
  if (!parsed.success) {
    return false;
  }
  const event = parsed.data.event.trim().toUpperCase();
  if (event.startsWith("SUBSCRIPTION_")) {
    return true;
  }
  return Boolean(parsed.data.payment?.subscription?.trim());
}
