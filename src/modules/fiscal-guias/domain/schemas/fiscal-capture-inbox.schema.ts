import { z } from "zod";
import { competenciaSchema, tipoGuiaSchema } from "./guia-fiscal.schema";

/** Codigo receita Federal — ex.: 0561 (IRRF), 3-4 digitos. */
export const codigoReceitaSchema = z
  .string()
  .regex(/^\d{3,4}$/, "codigo_receita deve ter 3 ou 4 digitos numericos.");

/**
 * Payload aceito via POST /v1/inbox/webhooks quando event_type = fiscal.capture.requested.
 * Idempotência: (tenant_id resolvido pelo inbox, idempotency_key).
 *
 * DARF exige `codigo_receita` e `periodo_apuracao` (YYYY-MM-DD).
 */
export const fiscalCaptureInboxPayloadSchema = z
  .object({
    event_type: z.literal("fiscal.capture.requested"),
    portal_cliente_id: z.string().uuid(),
    tipo_guia: tipoGuiaSchema,
    competencia: competenciaSchema,
    codigo_receita: codigoReceitaSchema.optional(),
    periodo_apuracao: z.string().date().optional(),
    idempotency_key: z
      .string()
      .min(8)
      .max(200)
      .regex(
        /^[a-zA-Z0-9:_\-]+$/,
        "idempotency_key: apenas caracteres alfanumericos, :, _, -"
      ),
    correlation_id: z.string().max(128).optional(),
    n8n_execution_id: z.string().max(128).optional()
  })
  .superRefine((data, ctx) => {
    if (data.tipo_guia !== "DARF") {
      return;
    }
    if (!data.codigo_receita?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["codigo_receita"],
        message: "codigo_receita obrigatorio para tipo_guia DARF."
      });
    }
    if (!data.periodo_apuracao?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["periodo_apuracao"],
        message: "periodo_apuracao obrigatorio para tipo_guia DARF (YYYY-MM-DD)."
      });
    }
  });

export type FiscalCaptureInboxPayload = z.infer<typeof fiscalCaptureInboxPayloadSchema>;

export function parseFiscalCaptureInboxPayload(
  body: unknown
): { ok: true; value: FiscalCaptureInboxPayload } | { ok: false; issues: z.ZodIssue[] } {
  const parsed = fiscalCaptureInboxPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues };
  }
  return { ok: true, value: parsed.data };
}
