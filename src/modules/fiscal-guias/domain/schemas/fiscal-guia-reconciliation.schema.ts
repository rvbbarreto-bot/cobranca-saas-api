import { z } from "zod";

export const fiscalGuiaReconciliationInboxSchema = z
  .object({
    event_type: z.literal("fiscal.guia.reconciliation.requested"),
    idempotency_key: z.string().trim().min(1).max(200),
    valor_pago: z.number().positive(),
    data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "data_pagamento deve ser YYYY-MM-DD"),
    guia_fiscal_id: z.string().uuid().optional(),
    linha_digitavel: z.string().trim().min(10).max(120).optional(),
    referencia_externa: z.string().trim().max(500).optional(),
    comprovante_url: z.string().url().max(2000).optional()
  })
  .refine((v) => Boolean(v.guia_fiscal_id?.trim() || v.linha_digitavel?.trim()), {
    message: "Informe guia_fiscal_id ou linha_digitavel para conciliação.",
    path: ["guia_fiscal_id"]
  });

export type FiscalGuiaReconciliationInboxPayload = z.infer<typeof fiscalGuiaReconciliationInboxSchema>;

export function parseFiscalGuiaReconciliationInboxPayload(
  payload: unknown
):
  | { ok: true; value: FiscalGuiaReconciliationInboxPayload }
  | { ok: false; issues: z.ZodIssue[] } {
  const parsed = fiscalGuiaReconciliationInboxSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues };
  }
  return { ok: true, value: parsed.data };
}

/** Normaliza linha digitável para comparação (somente dígitos). */
export function normalizeLinhaDigitavel(value: string): string {
  return value.replace(/\D/g, "");
}
