import { z } from "zod";
import { valorMonetarioSchema } from "./guia-fiscal.schema";

export const postGuiaPagamentoBodySchema = z.object({
  valor_pago: valorMonetarioSchema,
  data_pagamento: z.string().date(),
  meio: z.enum(["pix", "boleto", "manual", "conciliacao"]).default("manual"),
  comprovante_url: z.string().url().max(2048).optional()
});

export type PostGuiaPagamentoBody = z.infer<typeof postGuiaPagamentoBodySchema>;

export const guiaPagamentoResponseSchema = z.object({
  id: z.string().uuid(),
  guia_fiscal_id: z.string().uuid(),
  valor_pago: z.number(),
  data_pagamento: z.string().date(),
  meio: z.enum(["pix", "boleto", "manual", "conciliacao"]),
  comprovante_url: z.string().nullable(),
  created_at: z.string()
});

export type GuiaPagamentoResponse = z.infer<typeof guiaPagamentoResponseSchema>;

export function parsePostGuiaPagamentoBody(
  body: unknown
): { ok: true; value: PostGuiaPagamentoBody } | { ok: false; issues: z.ZodIssue[] } {
  const parsed = postGuiaPagamentoBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues };
  }
  return { ok: true, value: parsed.data };
}
