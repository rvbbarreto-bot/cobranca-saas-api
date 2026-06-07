import { z } from "zod";

export const ANEXO_VALUES = [
  "ANEXO_I",
  "ANEXO_II",
  "ANEXO_III",
  "ANEXO_IV",
  "ANEXO_V"
] as const;

export const canonicalApuracaoSchema = z.object({
  cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve ter 14 digitos"),
  competencia: z.string().regex(/^\d{4}-\d{2}$/, "Competencia YYYY-MM"),
  receitaBrutaMes: z.number().min(0),
  regime: z.literal("SIMPLES"),
  anexo: z.enum(ANEXO_VALUES),
  tributos: z.object({
    inss: z.number().min(0),
    icms: z.number().min(0),
    iss: z.number().min(0),
    pisCofins: z.number().min(0)
  }),
  valorTotalDas: z.number().min(0),
      metadata: z
    .object({
      razaoSocial: z.string().max(200).optional(),
      observacao: z.string().max(500).optional(),
      idExternoErp: z.string().max(80).optional(),
      portalClienteId: z.string().uuid().optional(),
      sourceLine: z.number().int().positive().optional()
    })
    .optional()
});

export type CanonicalApuracao = z.infer<typeof canonicalApuracaoSchema>;

export type IngestLineError = {
  linha: number;
  campo: string;
  codigo: string;
  mensagem: string;
};

export const DAS_TOTAL_TOLERANCE = 0.02;

export function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function validateDasTotalTolerance(apuracao: CanonicalApuracao): boolean {
  const sum =
    apuracao.tributos.inss +
    apuracao.tributos.icms +
    apuracao.tributos.iss +
    apuracao.tributos.pisCofins;
  return Math.abs(apuracao.valorTotalDas - sum) <= DAS_TOTAL_TOLERANCE;
}

export function isCompetenciaTooFarFuture(competencia: string, asOf = new Date()): boolean {
  const [y, m] = competencia.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return true;
  const compEnd = new Date(y, m, 0);
  const limit = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0);
  return compEnd > limit;
}
