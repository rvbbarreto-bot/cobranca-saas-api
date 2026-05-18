import { z } from "zod";
import type { CanonicalChargeStatus } from "../../billing-core/domain/charge";

const canonicalStatusSchema = z.enum([
  "rascunho",
  "emitida",
  "enviada",
  "pendente_pagamento",
  "paga",
  "vencida",
  "cancelada",
  "erro_emissao"
]);

const chargeInstructionSchema = z
  .object({
    canonical_status: canonicalStatusSchema,
    reference: z.string().min(1).max(256).optional(),
    provider_charge_id: z.string().min(1).max(256).optional()
  })
  .refine((v) => Boolean(v.reference?.trim()) || Boolean(v.provider_charge_id?.trim()), {
    message: "Informe reference ou provider_charge_id.",
    path: ["reference"]
  });

export type WebhookChargeInstruction = {
  canonicalStatus: CanonicalChargeStatus;
  reference?: string;
  providerChargeId?: string;
};

function unwrapPayload(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const p = payload as Record<string, unknown>;
  if (p.charge && typeof p.charge === "object") {
    return p.charge;
  }
  if (p.data && typeof p.data === "object") {
    return p.data;
  }
  if (p.payload && typeof p.payload === "object") {
    return p.payload;
  }
  return p;
}

export function parseWebhookChargePayload(payload: unknown):
  | { ok: true; value: WebhookChargeInstruction }
  | { ok: false; issues: string[] } {
  const candidate = unwrapPayload(payload);
  const parsed = chargeInstructionSchema.safeParse(candidate);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    return { ok: false, issues };
  }
  const d = parsed.data;
  return {
    ok: true,
    value: {
      canonicalStatus: d.canonical_status,
      reference: d.reference?.trim(),
      providerChargeId: d.provider_charge_id?.trim()
    }
  };
}
