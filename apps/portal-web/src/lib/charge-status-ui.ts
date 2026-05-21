import type { ChargeRow } from "./api";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  emitida: "Emitido",
  enviada: "Enviado",
  pendente_pagamento: "Pendente",
  paga: "Pago",
  vencida: "Vencido",
  cancelada: "Cancelado",
  erro_emissao: "Falha"
};

export function chargeStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status.replace(/_/g, " ");
}

/** Rótulos voltados ao operador do portal (alinhados ao protótipo). */
/** Cobranças terminais não podem ser editadas via PATCH portal. */
export function isChargeEditable(status: string): boolean {
  return status !== "paga" && status !== "cancelada";
}

export function chargeStatusLabelPortal(status: string): string {
  if (status === "rascunho") {
    return "Agendado";
  }
  return chargeStatusLabel(status);
}

export function chargeStatusPillClass(status: string): string {
  const base = "status-pill";
  switch (status) {
    case "paga":
      return `${base} status-pill--paga`;
    case "emitida":
      return `${base} status-pill--emitida`;
    case "enviada":
      return `${base} status-pill--enviada`;
    case "pendente_pagamento":
      return `${base} status-pill--pendente_pagamento`;
    case "vencida":
      return `${base} status-pill--vencida`;
    case "cancelada":
      return `${base} status-pill--cancelada`;
    case "erro_emissao":
      return `${base} status-pill--falha`;
    case "rascunho":
      return `${base} status-pill--programado`;
    default:
      return `${base} status-pill--rascunho`;
  }
}

export function bankLabel(row: ChargeRow & { provider?: string | null }): string {
  const p = row.provider;
  if (typeof p === "string" && p.trim()) {
    const t = p.trim();
    if (/^inter$/i.test(t)) {
      return "Inter";
    }
    if (/^cora$/i.test(t)) {
      return "Cora";
    }
    if (/^c6$/i.test(t)) {
      return "C6";
    }
    return t;
  }
  return "—";
}

export function competenciaFromDue(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${yyyy}`;
}

const N8 = 8;

/** Exibe um identificador curto estilo “nosso número” para a lista de boletos. */
export function nossoNumeroDisplay(row: ChargeRow): string {
  const hex = row.id.replace(/-/g, "");
  if (hex.length >= N8) {
    return hex.slice(-N8).toUpperCase();
  }
  const ref = row.reference.replace(/\D/g, "");
  if (ref.length >= N8) {
    return ref.slice(-N8);
  }
  return row.reference.slice(0, N8).padEnd(N8, "0");
}

export function portalClienteIdFromMetadata(row: ChargeRow): string | undefined {
  const m = row.metadata;
  if (!m || typeof m !== "object") {
    return undefined;
  }
  const o = m as Record<string, unknown>;
  const v = o.portal_cliente_id ?? o.portalClienteId;
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function chargeClienteNome(row: ChargeRow): string {
  const m = row.metadata as Record<string, unknown> | undefined;
  if (m && typeof m === "object") {
    const n = m.cliente_nome ?? m.nome_cliente ?? m.customer_name ?? m.tomador_nome;
    if (typeof n === "string" && n.trim()) {
      return n.trim();
    }
  }
  return row.reference;
}
