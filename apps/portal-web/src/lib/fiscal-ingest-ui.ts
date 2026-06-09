export type FiscalIngestStatus = "VALIDANDO" | "VALIDADO" | "ERRO";

export const FISCAL_INGEST_POLL_MS = 3000;

const STATUS_LABEL: Record<FiscalIngestStatus, string> = {
  VALIDANDO: "Validando arquivo…",
  VALIDADO: "Arquivo validado",
  ERRO: "Erro na validação"
};

const STATUS_PILL: Record<FiscalIngestStatus, string> = {
  VALIDANDO: "status-pill--pendente",
  VALIDADO: "status-pill--ativo",
  ERRO: "status-pill--erro"
};

export function fiscalIngestStatusLabel(status: string): string {
  return STATUS_LABEL[status as FiscalIngestStatus] ?? status;
}

export function fiscalIngestStatusPillClass(status: string): string {
  return STATUS_PILL[status as FiscalIngestStatus] ?? "status-pill--pendente";
}

export function shouldPollFiscalIngest(status: string | undefined): boolean {
  return status === "VALIDANDO";
}

export function canStartTransmissionFromIngest(status: string | undefined): boolean {
  return status === "VALIDADO";
}

export function formatIngestLineError(err: {
  linha: number;
  campo: string;
  codigo: string;
  mensagem: string;
}): string {
  return `Linha ${err.linha} · ${err.campo}: ${err.mensagem} (${err.codigo})`;
}

export const PGDASD_CSV_REQUIRED_COLUMNS = [
  "cnpj",
  "competencia",
  "receita_bruta_mes",
  "regime_tributario",
  "anexo",
  "valor_inss",
  "valor_icms",
  "valor_iss",
  "valor_pis_cofins",
  "valor_total_das"
] as const;

export function isCsvFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".csv") || file.type === "text/csv" || file.type === "application/vnd.ms-excel";
}

export const PGDASD_CSV_MAX_BYTES = 2 * 1024 * 1024;
