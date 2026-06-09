import type { GuiasFiscaisListQuery } from "./api";

export type TipoGuiaFiltro = "" | "DAS" | "DARF";

export const TIPO_GUIA_FILTER_OPTIONS: { value: TipoGuiaFiltro; label: string }[] = [
  { value: "", label: "Todos os tipos" },
  { value: "DAS", label: "DAS (Simples)" },
  { value: "DARF", label: "DARF" }
];

const TIPO_GUIA_LABEL: Record<string, string> = {
  DAS: "DAS — Simples Nacional",
  DARF: "DARF — Receitas Federais"
};

const STATUS_LABEL: Record<string, string> = {
  PROCESSANDO: "Processando",
  DISPONIVEL: "Disponível",
  PAGO: "Paga",
  VENCIDO: "Vencida",
  EM_CONTESTACAO: "Em contestação",
  RETIFICADO: "Retificada",
  CANCELADO: "Cancelada"
};

const COMPLIANCE_LABEL: Record<string, string> = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  bloqueado: "Bloqueado",
  dispensado: "Dispensado"
};

export function tipoGuiaLabel(tipo: string): string {
  return TIPO_GUIA_LABEL[tipo] ?? tipo;
}

export function tipoGuiaShortLabel(tipo: string): string {
  return tipo === "DARF" ? "DARF" : tipo === "DAS" ? "DAS" : tipo;
}

export function guiaFiscalStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

export function guiaFiscalComplianceLabel(status: string): string {
  return COMPLIANCE_LABEL[status] ?? status;
}

export function guiaFiscalStatusPillClass(status: string): string {
  const base = "status-pill";
  switch (status) {
    case "DISPONIVEL":
      return `${base} status-pill--emitida`;
    case "PAGO":
      return `${base} status-pill--paga`;
    case "VENCIDO":
      return `${base} status-pill--vencida`;
    case "PROCESSANDO":
      return `${base} status-pill--pendente_pagamento`;
    case "CANCELADO":
      return `${base} status-pill--cancelada`;
    case "EM_CONTESTACAO":
      return `${base} status-pill--atencao`;
    case "RETIFICADO":
      return `${base} status-pill--programado`;
    default:
      return `${base} status-pill--rascunho`;
  }
}

export function tipoGuiaPillClass(tipo: string): string {
  const base = "status-pill";
  if (tipo === "DARF") {
    return `${base} guia-tipo-pill--darf`;
  }
  if (tipo === "DAS") {
    return `${base} guia-tipo-pill--das`;
  }
  return base;
}

export function guiaFiscalCompliancePillClass(status: string): string {
  const base = "status-pill";
  switch (status) {
    case "aprovado":
    case "dispensado":
      return `${base} status-pill--paga`;
    case "bloqueado":
      return `${base} status-pill--falha`;
    case "pendente":
      return `${base} status-pill--pendente_pagamento`;
    default:
      return `${base} status-pill--rascunho`;
  }
}

/** Valida competência YYYY-MM para filtro local antes de chamar API. */
export function isValidCompetenciaFilter(value: string): boolean {
  if (!value.trim()) {
    return true;
  }
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value.trim());
}

export function buildGuiasFiscaisListQuery(input: {
  limit: number;
  cursor?: string;
  tipoGuia?: TipoGuiaFiltro;
  competencia?: string;
}): GuiasFiscaisListQuery {
  const q: GuiasFiscaisListQuery = { limit: input.limit };
  if (input.cursor) {
    q.cursor = input.cursor;
  }
  if (input.tipoGuia === "DAS" || input.tipoGuia === "DARF") {
    q.tipo_guia = input.tipoGuia;
  }
  const comp = input.competencia?.trim();
  if (comp && isValidCompetenciaFilter(comp)) {
    q.competencia = comp;
  }
  return q;
}
