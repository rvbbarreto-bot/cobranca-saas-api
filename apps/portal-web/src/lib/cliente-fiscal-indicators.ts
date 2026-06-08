import type {
  CertificadoDigitalRow,
  ExpiringCertificateRow,
  ProcessamentoFiscalRow,
  ProcuracaoRow
} from "./api";
import {
  certificadoExpiryBadgeLabel,
  certificadoExpiryTone,
  type CertificadoExpiryTone,
  serproSituacaoTone,
  type SerproSituacaoTone
} from "./fiscal-config-ui";
import { processamentoStatusLabel } from "./processamento-fiscal-ui";

export type ClienteCertificadoIndicator = {
  tone: CertificadoExpiryTone | "missing";
  label: string;
  pillClass: string;
};

export type ClienteProcuracaoIndicator = {
  tone: SerproSituacaoTone;
  label: string;
  pillClass: string;
};

export type ClienteProcessamentoIndicator = {
  id: string | null;
  competencia: string | null;
  status: string | null;
  label: string;
  pillClass: string;
};

export type ClienteFiscalIndicators = {
  certificado: ClienteCertificadoIndicator;
  procuracao: ClienteProcuracaoIndicator;
  processamento: ClienteProcessamentoIndicator;
};

export function readProcuracaoSerproSituacao(proc: ProcuracaoRow | null | undefined): string | undefined {
  if (!proc?.metadata || typeof proc.metadata.serpro_situacao !== "string") {
    return undefined;
  }
  return proc.metadata.serpro_situacao;
}

export function resolveCertificadoIndicator(
  cert: CertificadoDigitalRow | null | undefined,
  expiring?: Pick<ExpiringCertificateRow, "days_left" | "valid_until">
): ClienteCertificadoIndicator {
  if (!cert) {
    return {
      tone: "missing",
      label: "Sem cert.",
      pillClass: "cliente-fiscal-pill cliente-fiscal-pill--missing"
    };
  }
  const tone = certificadoExpiryTone({
    valid_until: cert.valid_until,
    days_left: expiring?.days_left
  });
  const label = certificadoExpiryBadgeLabel({
    valid_until: cert.valid_until,
    days_left: expiring?.days_left
  });
  return {
    tone,
    label,
    pillClass: `cliente-fiscal-pill cliente-fiscal-pill--cert-${tone}`
  };
}

const PROCURACAO_LABEL: Record<string, string> = {
  valida: "Proc. OK",
  expirada: "Proc. exp.",
  inexistente: "Sem proc.",
  nao_validada: "Validar proc.",
  erro_serpro: "Proc. erro"
};

export function resolveProcuracaoIndicator(
  proc: ProcuracaoRow | null | undefined
): ClienteProcuracaoIndicator {
  if (!proc) {
    return {
      tone: "yellow",
      label: "Sem proc.",
      pillClass: "cliente-fiscal-pill cliente-fiscal-pill--proc-yellow"
    };
  }
  const situacao = readProcuracaoSerproSituacao(proc) ?? (proc.ativa ? "nao_validada" : "inexistente");
  const tone = serproSituacaoTone(situacao);
  const label = PROCURACAO_LABEL[situacao] ?? "Procuração";
  return {
    tone,
    label,
    pillClass: `cliente-fiscal-pill cliente-fiscal-pill--proc-${tone}`
  };
}

export function indexLatestProcessamentosByCliente(
  processamentos: ProcessamentoFiscalRow[]
): Map<string, ProcessamentoFiscalRow> {
  const map = new Map<string, ProcessamentoFiscalRow>();
  const sorted = [...processamentos].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  for (const row of sorted) {
    if (!row.portal_cliente_id || map.has(row.portal_cliente_id)) {
      continue;
    }
    map.set(row.portal_cliente_id, row);
  }
  return map;
}

function processamentoIndicatorPillClass(status: string | null): string {
  if (!status) return "cliente-fiscal-pill cliente-fiscal-pill--proc-gray";
  if (status === "CONCLUIDO") return "cliente-fiscal-pill cliente-fiscal-pill--proc-green";
  if (status === "ERRO") return "cliente-fiscal-pill cliente-fiscal-pill--proc-red";
  return "cliente-fiscal-pill cliente-fiscal-pill--proc-yellow";
}

export function formatCompetenciaShort(competencia: string | null | undefined): string {
  if (!competencia?.trim()) return "";
  const [year, month] = competencia.split("-");
  if (!year || !month) return competencia;
  const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const idx = Number(month) - 1;
  if (idx < 0 || idx > 11) return competencia;
  return `${monthNames[idx]}/${year.slice(-2)}`;
}

export function resolveProcessamentoIndicator(
  proc: ProcessamentoFiscalRow | null | undefined
): ClienteProcessamentoIndicator {
  if (!proc) {
    return {
      id: null,
      competencia: null,
      status: null,
      label: "Sem PGDASD",
      pillClass: "cliente-fiscal-pill cliente-fiscal-pill--missing"
    };
  }
  const comp = formatCompetenciaShort(proc.competencia);
  const statusLabel = processamentoStatusLabel(proc.status);
  return {
    id: proc.id,
    competencia: proc.competencia,
    status: proc.status,
    label: comp ? `${statusLabel} ${comp}` : statusLabel,
    pillClass: processamentoIndicatorPillClass(proc.status)
  };
}

export function buildClienteFiscalIndicators(input: {
  certificado: CertificadoDigitalRow | null | undefined;
  expiring?: ExpiringCertificateRow;
  procuracao: ProcuracaoRow | null | undefined;
  latestProcessamento: ProcessamentoFiscalRow | null | undefined;
}): ClienteFiscalIndicators {
  return {
    certificado: resolveCertificadoIndicator(input.certificado, input.expiring),
    procuracao: resolveProcuracaoIndicator(input.procuracao),
    processamento: resolveProcessamentoIndicator(input.latestProcessamento)
  };
}

export function novaApuracaoImportHref(clienteId?: string): string {
  if (!clienteId?.trim()) {
    return "/processamentos-fiscais/importar";
  }
  return `/processamentos-fiscais/importar?clienteId=${encodeURIComponent(clienteId.trim())}`;
}

export function expiringCertificatesByCliente(
  certificados: ExpiringCertificateRow[]
): Map<string, ExpiringCertificateRow> {
  const map = new Map<string, ExpiringCertificateRow>();
  for (const row of certificados) {
    if (row.portal_cliente_id) {
      map.set(row.portal_cliente_id, row);
    }
  }
  return map;
}
