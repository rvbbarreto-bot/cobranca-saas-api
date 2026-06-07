import { z } from "zod";
import type { ReceitaCaptureResult, ReceitaComplianceStatus } from "../../domain/receita-gateway.interface";

const complianceSchema = z.enum(["pendente", "aprovado", "bloqueado", "dispensado"]);

/** Resposta JSON comum DAS/DARF — ADR sec. 12 e 15. */
export const receitaCaptureResponseSchema = z.object({
  valor_principal: z.coerce.number().nonnegative(),
  valor_multa: z.coerce.number().nonnegative().optional().default(0),
  valor_juros: z.coerce.number().nonnegative().optional().default(0),
  data_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  linha_digitavel: z.string().min(10),
  pix_copia_cola: z.string().optional(),
  pdf_base64: z.string().optional(),
  compliance_status: complianceSchema.optional(),
  compliance_motivo: z.string().optional()
});

export type ReceitaCaptureResponseJson = z.infer<typeof receitaCaptureResponseSchema>;

export function mapReceitaCaptureResponse(json: ReceitaCaptureResponseJson): ReceitaCaptureResult {
  let pdfBytes: Buffer | undefined;
  if (json.pdf_base64?.trim()) {
    pdfBytes = Buffer.from(json.pdf_base64.trim(), "base64");
  }
  return {
    valorPrincipal: json.valor_principal,
    valorMulta: json.valor_multa,
    valorJuros: json.valor_juros,
    dataVencimento: json.data_vencimento,
    linhaDigitavel: json.linha_digitavel,
    pixCopiaCola: json.pix_copia_cola,
    pdfBytes,
    complianceStatus: json.compliance_status as ReceitaComplianceStatus | undefined,
    complianceMotivo: json.compliance_motivo
  };
}

export function parseReceitaCaptureResponse(body: unknown): ReceitaCaptureResult {
  const parsed = receitaCaptureResponseSchema.parse(body);
  return mapReceitaCaptureResponse(parsed);
}
