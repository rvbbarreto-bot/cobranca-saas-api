import type { GuiaFiscalResponse } from "../domain/schemas/guia-fiscal.schema";
import type { GuiaFiscalRow } from "../infrastructure/guia-fiscal-repository";

function toNumber(value: string): number {
  return Number(value);
}

export function mapGuiaFiscalRowToResponse(row: GuiaFiscalRow): GuiaFiscalResponse {
  return {
    id: row.id,
    portal_cliente_id: row.portal_cliente_id,
    tipo_guia: row.tipo_guia,
    competencia: row.competencia,
    data_vencimento: row.data_vencimento,
    valor_principal: toNumber(row.valor_principal),
    valor_multa: toNumber(row.valor_multa),
    valor_juros: toNumber(row.valor_juros),
    valor_total: toNumber(row.valor_total),
    linha_digitavel: row.linha_digitavel,
    pix_copia_cola: row.pix_copia_cola,
    status: row.status,
    compliance_status: row.compliance_status as GuiaFiscalResponse["compliance_status"],
    compliance_motivo: row.compliance_motivo,
    pdf_url: row.pdf_url,
    versao_atual: row.versao_atual,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };
}

export function guiaFiscalCursorFromRow(row: GuiaFiscalRow): string {
  const payload = {
    ca: row.created_at.toISOString(),
    id: row.id
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export type GuiaFiscalParsedCursor = { ca: string; id: string };

export function parseGuiaFiscalListCursor(
  raw: string | undefined
): GuiaFiscalParsedCursor | null | "invalid" {
  if (!raw?.trim()) {
    return null;
  }
  try {
    const json = Buffer.from(raw.trim(), "base64url").toString("utf8");
    const parsed = JSON.parse(json) as { ca?: unknown; id?: unknown };
    if (typeof parsed.ca !== "string" || typeof parsed.id !== "string") {
      return "invalid";
    }
    if (!parsed.id.trim()) {
      return "invalid";
    }
    return { ca: parsed.ca, id: parsed.id };
  } catch {
    return "invalid";
  }
}
