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
  externalReference: z.string().max(256).optional(),
  value: z.union([z.number(), z.string()]).optional(),
  netValue: z.union([z.number(), z.string()]).optional(),
  paymentDate: z.string().max(64).optional(),
  clientPaymentDate: z.string().max(64).optional()
});

const asaasWebhookSchema = z.object({
  event: z.string().min(1).max(128),
  payment: asaasPaymentSchema.optional()
});

export type AsaasWebhookContext = {
  event: string;
  instruction: WebhookChargeInstruction;
  valorPago?: number;
  dataPagamento?: string;
};

function parseMoney(value: unknown): number | undefined {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

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

/** Payload nativo Asaas com evento, payment.id e metadados para charge_events. */
export function parseAsaasWebhookContext(payload: unknown):
  | { ok: true; value: AsaasWebhookContext }
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

  const event = parsed.data.event.trim().toUpperCase();
  const canonicalStatus = resolveCanonicalStatus(event, payment.status);
  if (!canonicalStatus) {
    return {
      ok: false,
      issues: [`evento/status Asaas nao mapeado: ${event}/${payment.status ?? "?"}`]
    };
  }

  const valorPago = parseMoney(payment.netValue) ?? parseMoney(payment.value);
  const dataPagamento = payment.clientPaymentDate?.trim() || payment.paymentDate?.trim() || undefined;

  return {
    ok: true,
    value: {
      event,
      valorPago,
      dataPagamento,
      instruction: {
        canonicalStatus,
        providerChargeId: payment.id.trim(),
        reference: payment.externalReference?.trim()
      }
    }
  };
}
