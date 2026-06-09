export const FISCAL_AUDIT_ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todas as ações" },
  { value: "download_pdf", label: "Download PDF" },
  { value: "consulta_guia", label: "Consulta guia" },
  { value: "status_change", label: "Alteração de status" },
  { value: "upload_certificado", label: "Upload certificado" },
  { value: "admin_access", label: "Acesso admin" },
  { value: "guia_disponibilizada", label: "Guia disponibilizada" },
  { value: "compliance_bloqueio", label: "Bloqueio compliance" },
  { value: "capture_requested", label: "Captura solicitada" },
  { value: "capture_failed", label: "Falha na captura" },
  { value: "certificado_expirando", label: "Certificado expirando" },
  { value: "procuracao_validada_serpro", label: "Procuração validada SERPRO" },
  { value: "apuracao_iniciada", label: "Apuração iniciada (PGDASD)" },
  { value: "transmitida", label: "Transmissão SERPRO concluída" },
  { value: "erro_serpro", label: "Erro SERPRO (apuração)" }
];

const ACTION_LABEL: Record<string, string> = Object.fromEntries(
  FISCAL_AUDIT_ACTION_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
);

export function fiscalAuditActionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action.replace(/_/g, " ");
}

export function formatFiscalAuditDateTime(iso: string): string {
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

export type FiscalAuditListFilters = {
  from: string;
  to: string;
  action: string;
  userId: string;
};

export function buildFiscalAuditListQuery(
  filters: FiscalAuditListFilters,
  cursor?: string
): Record<string, string> {
  const q: Record<string, string> = { limit: "50" };
  if (filters.from.trim()) q.from = filters.from.trim();
  if (filters.to.trim()) q.to = filters.to.trim();
  if (filters.action.trim()) q.action = filters.action.trim();
  if (filters.userId.trim()) q.user_id = filters.userId.trim();
  if (cursor?.trim()) q.cursor = cursor.trim();
  return q;
}

export function fiscalAuditResourceSummary(entry: {
  resource_type: string;
  resource_id: string;
}): string {
  return `${entry.resource_type} · ${entry.resource_id.slice(0, 8)}…`;
}
