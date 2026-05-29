export type ChargeEventRow = {
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
  payload_json?: Record<string, unknown> | null;
};

export type TimelineItem = {
  time: string;
  text: string;
  kind: "info" | "teal" | "ok" | "err";
};

const EVENT_LABELS: Record<string, string> = {
  "charge.created": "Boleto criado no portal",
  erro_emissao: "Falha na emissão no gateway",
  "emission.reprocess": "Reprocessamento manual da emissão",
  "payment.emitted": "Emissão no banco concluída",
  "payment.created": "Pagamento registrado"
};

function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function labelForEvent(ev: ChargeEventRow): string {
  if (ev.event_type === "erro_emissao") {
    return EVENT_LABELS.erro_emissao;
  }
  if (EVENT_LABELS[ev.event_type]) {
    return EVENT_LABELS[ev.event_type];
  }
  if (ev.new_status && ev.old_status !== ev.new_status) {
    return `Status: ${ev.old_status ?? "—"} → ${ev.new_status}`;
  }
  return ev.event_type.replace(/[._]/g, " ");
}

function kindForEvent(ev: ChargeEventRow): TimelineItem["kind"] {
  if (ev.event_type === "erro_emissao") {
    return "err";
  }
  if (ev.event_type === "charge.created") {
    return "info";
  }
  if (ev.new_status === "emitida" || ev.event_type.includes("emitted")) {
    return "ok";
  }
  return "teal";
}

export function buildTimelineFromEvents(events: ChargeEventRow[]): TimelineItem[] {
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  return sorted.map((ev) => ({
    time: formatEventTime(ev.created_at),
    text: labelForEvent(ev),
    kind: kindForEvent(ev)
  }));
}

const TERMINAL_OK_STATUSES = new Set([
  "emitida",
  "enviada",
  "pendente_pagamento",
  "paga",
  "cancelada"
]);

/** Erro de emissão ainda vigente após reprocessamento manual (evento mais recente). */
export function hasEmissionReprocessAfterLastError(events: ChargeEventRow[]): boolean {
  const sorted = [...events].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  let lastErrorAt = 0;
  let lastReprocessAt = 0;
  for (const ev of sorted) {
    if (ev.event_type === "erro_emissao") {
      lastErrorAt = new Date(ev.created_at).getTime();
    }
    if (ev.event_type === "emission.reprocess") {
      lastReprocessAt = new Date(ev.created_at).getTime();
    }
  }
  return lastReprocessAt > lastErrorAt;
}

export function mapEmissionErrorToUserMessage(raw: string): string {
  const line = (raw.split("\n")[0] ?? raw).trim();
  if (!line) {
    return "Falha na emissão. Verifique credenciais do gateway em Configurações.";
  }
  if (line.includes("portal_cliente_address_required_for_emission")) {
    return "O banco exige endereço completo do cliente (CEP, logradouro, número, bairro, cidade e UF). Atualize o cadastro do pagador e tente novamente.";
  }
  if (line.includes("portal_cliente_id obrigatorio") || line.includes("portal_cliente_id")) {
    return "Esta cobrança precisa de um cliente (pagador) vinculado antes de emitir no banco.";
  }
  if (line.includes("portal_automacao_tenant_id")) {
    return "Dados internos da cobrança estão incompletos. Contate o suporte ou crie uma nova cobrança.";
  }
  if (line.includes("escritorio_config")) {
    return "Configuração do gateway não encontrada. Verifique Configurações do escritório.";
  }
  if (line.includes("unknown ca")) {
    return "Certificado não aceito pelo Banco Inter. Confirme integração sandbox e credenciais em Configurações.";
  }
  if (line.includes("bad base64 decode")) {
    return "Certificado ou chave PEM inválidos no gateway. Regrave em Configurações.";
  }
  if (line.includes("exige endereco completo")) {
    return line.length > 220 ? `${line.slice(0, 220)}…` : line;
  }
  if (/^[a-z0-9_.]+$/i.test(line) && line.includes("_")) {
    return "Falha na emissão no banco. Verifique o cadastro do cliente e as credenciais do gateway em Configurações.";
  }
  return line.length > 220 ? `${line.slice(0, 220)}…` : line;
}

export function extractEmissionError(
  events: ChargeEventRow[],
  options?: { chargeStatus?: string }
): string | null {
  const status = options?.chargeStatus;
  if (status && TERMINAL_OK_STATUSES.has(status)) {
    return null;
  }
  if (status === "rascunho" && hasEmissionReprocessAfterLastError(events)) {
    return null;
  }

  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev.event_type !== "erro_emissao") {
      continue;
    }
    const payload = ev.payload_json;
    const raw = payload && typeof payload.error === "string" ? payload.error.trim() : "";
    return mapEmissionErrorToUserMessage(raw);
  }
  return null;
}
