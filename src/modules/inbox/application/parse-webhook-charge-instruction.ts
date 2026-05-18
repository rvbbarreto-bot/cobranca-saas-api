import { parseAsaasWebhookContext, type AsaasWebhookContext } from "./parse-asaas-webhook-context";
import { parseWebhookChargePayload, type WebhookChargeInstruction } from "./parse-webhook-charge-payload";

export type ParsedWebhookChargeResult =
  | { ok: true; value: WebhookChargeInstruction; format: "asaas" | "canonical"; asaasContext?: AsaasWebhookContext }
  | { ok: false; issues: string[] };

/**
 * Tenta parser Asaas (webhook nativo) e depois o contrato canonico documentado.
 */
export function parseWebhookChargeInstruction(payload: unknown): ParsedWebhookChargeResult {
  const asaas = parseAsaasWebhookContext(payload);
  if (asaas.ok) {
    return {
      ok: true,
      value: asaas.value.instruction,
      format: "asaas",
      asaasContext: asaas.value
    };
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
