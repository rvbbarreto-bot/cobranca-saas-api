import { parseAsaasWebhookChargePayload } from "./parse-asaas-webhook-charge-payload";
import { parseWebhookChargePayload, type WebhookChargeInstruction } from "./parse-webhook-charge-payload";

export type ParsedWebhookChargeResult =
  | { ok: true; value: WebhookChargeInstruction; format: "asaas" | "canonical" }
  | { ok: false; issues: string[] };

/**
 * Tenta parser Asaas (webhook nativo) e depois o contrato canonico documentado.
 */
export function parseWebhookChargeInstruction(payload: unknown): ParsedWebhookChargeResult {
  const asaas = parseAsaasWebhookChargePayload(payload);
  if (asaas.ok) {
    return { ok: true, value: asaas.value, format: "asaas" };
  }

  const canonical = parseWebhookChargePayload(payload);
  if (canonical.ok) {
    return { ok: true, value: canonical.value, format: "canonical" };
  }

  return {
    ok: false,
    issues: [...asaas.issues, "---", ...canonical.issues]
  };
}
