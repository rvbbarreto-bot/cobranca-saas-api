import { z } from "zod";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export const postProcuracaoBodySchema = z
  .object({
    portal_cliente_id: z.string().uuid(),
    tipo: z.enum(["ecac", "receita_federal", "outro"]).default("ecac"),
    procurador_documento: z
      .string()
      .transform(onlyDigits)
      .refine((d) => d.length === 11 || d.length === 14, {
        message: "procurador_documento deve ser CPF (11) ou CNPJ (14) digitos."
      }),
    validade_inicio: z.string().date(),
    validade_fim: z.string().date(),
    ativa: z.boolean().optional().default(true),
    metadata: z.record(z.unknown()).optional()
  })
  .refine((v) => v.validade_fim >= v.validade_inicio, {
    message: "validade_fim deve ser >= validade_inicio",
    path: ["validade_fim"]
  });

export type PostProcuracaoBody = z.infer<typeof postProcuracaoBodySchema>;

export const procuracaoResponseSchema = z.object({
  id: z.string().uuid(),
  portal_cliente_id: z.string().uuid(),
  tipo: z.enum(["ecac", "receita_federal", "outro"]),
  procurador_documento: z.string(),
  validade_inicio: z.string().date(),
  validade_fim: z.string().date(),
  ativa: z.boolean(),
  metadata: z.record(z.unknown()),
  created_at: z.string(),
  updated_at: z.string()
});

export type ProcuracaoResponse = z.infer<typeof procuracaoResponseSchema>;

export function parsePostProcuracaoBody(
  body: unknown
): { ok: true; value: PostProcuracaoBody } | { ok: false; issues: z.ZodIssue[] } {
  const parsed = postProcuracaoBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues };
  }
  return { ok: true, value: parsed.data };
}
