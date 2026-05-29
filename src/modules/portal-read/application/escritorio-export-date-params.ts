import type { CobrancaExportFilters } from "./escritorio-cobrancas-export";

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidIsoDateOnly(value: string): boolean {
  const m = ISO_DATE_RE.exec(value.trim());
  if (!m) {
    return false;
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

export type CobrancaExportQueryInput = {
  status?: string;
  from?: string;
  to?: string;
  data_inicio?: string;
  data_fim?: string;
};

export type CobrancaExportQueryParseResult =
  | { ok: true; filters: CobrancaExportFilters }
  | { ok: false; error: string; code: string };

export function parseCobrancaExportQuery(input: CobrancaExportQueryInput): CobrancaExportQueryParseResult {
  const rawInicio = input.from?.trim() || input.data_inicio?.trim();
  const rawFim = input.to?.trim() || input.data_fim?.trim();

  let dataInicio: string | undefined;
  let dataFim: string | undefined;

  if (rawInicio) {
    if (!isValidIsoDateOnly(rawInicio)) {
      return {
        ok: false,
        code: "invalid_from",
        error: "Parametro from/data_inicio invalido (use YYYY-MM-DD)."
      };
    }
    dataInicio = rawInicio;
  }

  if (rawFim) {
    if (!isValidIsoDateOnly(rawFim)) {
      return {
        ok: false,
        code: "invalid_to",
        error: "Parametro to/data_fim invalido (use YYYY-MM-DD)."
      };
    }
    dataFim = rawFim;
  }

  if (dataInicio && dataFim && dataInicio > dataFim) {
    return {
      ok: false,
      code: "invalid_date_range",
      error: "Data inicial nao pode ser posterior a data final."
    };
  }

  const status = input.status?.trim();
  return {
    ok: true,
    filters: {
      ...(status ? { status } : {}),
      ...(dataInicio ? { dataInicio } : {}),
      ...(dataFim ? { dataFim } : {})
    }
  };
}
