import type { WebhookChargeInstruction } from "./parse-webhook-charge-payload";
import { parseAsaasWebhookContext } from "./parse-asaas-webhook-context";

/**
 * Payload nativo do webhook Asaas (event + payment).
 * Resolve cobrança interna por provider_charge_id = payment.id.
 */
export function parseAsaasWebhookChargePayload(payload: unknown):
  | { ok: true; value: WebhookChargeInstruction }
  | { ok: false; issues: string[] } {
  const parsed = parseAsaasWebhookContext(payload);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true, value: parsed.value.instruction };
}
