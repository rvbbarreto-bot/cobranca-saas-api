import type { CertificadoDigitalRow, ProcuracaoRow } from "./api";

const PROCURACAO_TIPO_LABEL: Record<ProcuracaoRow["tipo"], string> = {
  ecac: "e-CAC",
  receita_federal: "Receita Federal",
  outro: "Outro"
};

export function formatFiscalConfigDate(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return isoDate;
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatFiscalConfigDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function procuracaoTipoLabel(tipo: ProcuracaoRow["tipo"]): string {
  return PROCURACAO_TIPO_LABEL[tipo] ?? tipo;
}

export function certificadoVigenciaLabel(cert: CertificadoDigitalRow): string {
  return `${formatFiscalConfigDate(cert.valid_from)} — ${formatFiscalConfigDate(cert.valid_until)}`;
}

export function procuracaoVigenciaLabel(proc: ProcuracaoRow): string {
  return `${formatFiscalConfigDate(proc.validade_inicio)} — ${formatFiscalConfigDate(proc.validade_fim)}`;
}

export function formatProcuradorDocumento(doc: string): string {
  const digits = doc.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

/** EXEQ-FISC-075/076 — badges certificado e semáforo SERPRO */

export type CertificadoExpiryTone = "ok" | "warning" | "danger" | "unknown";

export function certificadoExpiryTone(input: {
  valid_until?: string;
  days_left?: number;
}): CertificadoExpiryTone {
  if (typeof input.days_left === "number") {
    if (input.days_left <= 7) return "danger";
    if (input.days_left <= 30) return "warning";
    return "ok";
  }
  if (!input.valid_until) return "unknown";
  const until = new Date(`${input.valid_until}T23:59:59`);
  if (Number.isNaN(until.getTime())) return "unknown";
  const days = Math.ceil((until.getTime() - Date.now()) / 86_400_000);
  if (days <= 7) return "danger";
  if (days <= 30) return "warning";
  return "ok";
}

export function certificadoExpiryBadgeLabel(input: {
  valid_until?: string;
  days_left?: number;
}): string {
  if (typeof input.days_left === "number") {
    if (input.days_left <= 0) return "Expirado";
    if (input.days_left <= 7) return `Expira em ${input.days_left}d`;
    if (input.days_left <= 30) return `Expira em ${input.days_left}d`;
    return "Vigente";
  }
  const tone = certificadoExpiryTone(input);
  if (tone === "danger") return "Expira em breve";
  if (tone === "warning") return "Renovar em breve";
  if (tone === "ok") return "Vigente";
  return "—";
}

export function certificadoExpiryPillClass(tone: CertificadoExpiryTone): string {
  if (tone === "danger") return "status-pill status-pill--erro";
  if (tone === "warning") return "status-pill status-pill--pendente";
  if (tone === "ok") return "status-pill status-pill--ativo";
  return "status-pill";
}

export type SerproSituacaoTone = "green" | "yellow" | "red" | "gray";

export function serproSituacaoTone(situacao: string | undefined): SerproSituacaoTone {
  const s = (situacao ?? "nao_validada").toLowerCase();
  if (s === "valida") return "green";
  if (s === "expirada" || s === "erro_serpro") return "red";
  if (s === "inexistente" || s === "nao_validada") return "yellow";
  return "gray";
}

export function serproSituacaoSemaphoreClass(tone: SerproSituacaoTone): string {
  return `fiscal-semaphore fiscal-semaphore--${tone}`;
}
