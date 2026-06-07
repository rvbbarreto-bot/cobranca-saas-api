import { z } from "zod";

/** Período de apuração — ex.: DAS Simples Nacional (YYYY-MM). */
export const competenciaSchema = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "competencia deve estar no formato YYYY-MM (01-12).");

export const valorMonetarioSchema = z
  .number()
  .nonnegative("valor deve ser >= 0")
  .max(999_999_999.99, "valor excede limite NUMERIC(14,2)");

/** Linha digitável boleto — 47 (bancário) ou 48 (arrecadação) dígitos. */
export const linhaDigitavelSchema = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .refine((d) => d.length === 47 || d.length === 48, {
    message: "linha_digitavel deve ter 47 ou 48 digitos."
  });

export const guiaFiscalStatusSchema = z.enum([
  "PROCESSANDO",
  "DISPONIVEL",
  "PAGO",
  "CANCELADO",
  "RETIFICADO",
  "VENCIDO",
  "EM_CONTESTACAO"
]);

export type GuiaFiscalStatus = z.infer<typeof guiaFiscalStatusSchema>;

export const tipoGuiaSchema = z.enum(["DAS", "DARF"]);

export type TipoGuia = z.infer<typeof tipoGuiaSchema>;

export const complianceStatusSchema = z.enum([
  "pendente",
  "aprovado",
  "bloqueado",
  "dispensado"
]);

export type ComplianceStatus = z.infer<typeof complianceStatusSchema>;

export const guiaFiscalVersaoMotivoSchema = z.enum([
  "retificacao",
  "correcao_sistema",
  "contestacao"
]);

/** Resposta API — espelha colunas fiscal.guia_fiscal (snake_case). */
export const guiaFiscalResponseSchema = z.object({
  id: z.string().uuid(),
  portal_cliente_id: z.string().uuid(),
  tipo_guia: tipoGuiaSchema,
  competencia: competenciaSchema,
  data_vencimento: z.string().date().nullable(),
  valor_principal: z.number(),
  valor_multa: z.number(),
  valor_juros: z.number(),
  valor_total: z.number(),
  linha_digitavel: z.string().nullable(),
  pix_copia_cola: z.string().nullable(),
  status: guiaFiscalStatusSchema,
  compliance_status: complianceStatusSchema,
  compliance_motivo: z.string().nullable(),
  pdf_url: z.string().url().nullable().or(z.literal(null)),
  versao_atual: z.number().int().positive(),
  created_at: z.string(),
  updated_at: z.string()
});

export type GuiaFiscalResponse = z.infer<typeof guiaFiscalResponseSchema>;

/** Query GET /v1/portal/fiscal/guias */
export const listGuiasFiscaisQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
  status: guiaFiscalStatusSchema.optional(),
  tipo_guia: tipoGuiaSchema.optional(),
  portal_cliente_id: z.string().uuid().optional(),
  competencia: competenciaSchema.optional()
});

export type ListGuiasFiscaisQuery = z.infer<typeof listGuiasFiscaisQuerySchema>;

/** Payload interno após captura (persistência). */
export const guiaFiscalPersistSchema = z.object({
  portal_cliente_id: z.string().uuid(),
  tipo_guia: tipoGuiaSchema,
  competencia: competenciaSchema,
  data_vencimento: z.string().date().optional(),
  valor_principal: valorMonetarioSchema,
  valor_multa: valorMonetarioSchema.optional().default(0),
  valor_juros: valorMonetarioSchema.optional().default(0),
  linha_digitavel: linhaDigitavelSchema.optional(),
  pix_copia_cola: z.string().max(512).optional(),
  idempotency_key: z.string().min(8).max(200),
  metadata: z.record(z.unknown()).optional()
});

export type GuiaFiscalPersistInput = z.infer<typeof guiaFiscalPersistSchema>;
