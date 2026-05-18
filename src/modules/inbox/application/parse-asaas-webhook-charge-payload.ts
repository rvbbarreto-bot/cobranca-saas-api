import { z } from "zod";
import type { CanonicalChargeStatus } from "../../billing-core/domain/charge";
import {
  mapAsaasPaymentFieldStatus,
  mapAsaasWebhookEvent
} from "../../payment-gateway/domain/asaas-status-map";
import type { WebhookChargeInstruction } from "./parse-webhook-charge-payload";

const asaasPaymentSchema = z.object({
  id: z.string().min(1).max(256),
  status: z.string().max(64).optional(),
  externalReference: z.string().max(256).optional()
});

const asaasWebhookSchema = z.object({
  event: z.string().min(1).max(128),
  payment: asaasPaymentSchema.optional()
});

function resolveCanonicalStatus(event: string, paymentStatus?: string): CanonicalChargeStatus | undefined {
  const fromEvent = mapAsaasWebhookEvent(event);
  if (fromEvent) {
    return fromEvent;
  }
  if (paymentStatus) {
    return mapAsaasPaymentFieldStatus(paymentStatus);
  }
  return undefined;
}

/**
 * Payload nativo do webhook Asaas (event + payment).
 * Resolve cobrança interna por provider_charge_id = payment.id.
 */
export function parseAsaasWebhookChargePayload(payload: unknown):
  | { ok: true; value: WebhookChargeInstruction }
  | { ok: false; issues: string[] } {
  const parsed = asaasWebhookSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
    };
  }

  const payment = parsed.data.payment;
  if (!payment) {
    return { ok: false, issues: ["payment: obrigatorio no webhook Asaas"] };
  }

  const canonicalStatus = resolveCanonicalStatus(parsed.data.event, payment.status);
  if (!canonicalStatus) {
    return {
      ok: false,
      issues: [`evento/status Asaas nao mapeado: ${parsed.data.event}/${payment.status ?? "?"}`]
    };
  }

  return {
    ok: true,
    value: {
      canonicalStatus,
      providerChargeId: payment.id.trim(),
      reference: payment.externalReference?.trim()
    }
  };
}
