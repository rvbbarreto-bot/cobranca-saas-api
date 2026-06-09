import { z } from "zod";

const pemMinLength = 100;

export const postCertificadoDigitalBodySchema = z
  .object({
    portal_cliente_id: z.string().uuid(),
    label: z.string().trim().min(1).max(80),
    valid_from: z.string().date(),
    valid_until: z.string().date(),
    certificado_pem: z.string().min(pemMinLength, "certificado_pem invalido ou truncado"),
    chave_privada_pem: z.string().min(pemMinLength, "chave_privada_pem invalida ou truncada")
  })
  .refine((v) => v.valid_until >= v.valid_from, {
    message: "valid_until deve ser >= valid_from",
    path: ["valid_until"]
  })
  .refine(
    (v) =>
      v.certificado_pem.includes("BEGIN CERTIFICATE") &&
      v.chave_privada_pem.includes("BEGIN"),
    {
      message: "PEM deve conter cabecalho BEGIN",
      path: ["certificado_pem"]
    }
  );

export type PostCertificadoDigitalBody = z.infer<typeof postCertificadoDigitalBodySchema>;

export const certificadoDigitalResponseSchema = z.object({
  id: z.string().uuid(),
  portal_cliente_id: z.string().uuid(),
  label: z.string(),
  valid_from: z.string().date(),
  valid_until: z.string().date(),
  ativo: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
});

export type CertificadoDigitalResponse = z.infer<typeof certificadoDigitalResponseSchema>;

export function parsePostCertificadoDigitalBody(
  body: unknown
): { ok: true; value: PostCertificadoDigitalBody } | { ok: false; issues: z.ZodIssue[] } {
  const parsed = postCertificadoDigitalBodySchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues };
  }
  return { ok: true, value: parsed.data };
}
