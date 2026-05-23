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

export function extractEmissionError(events: ChargeEventRow[]): string | null {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    const ev = events[i];
    if (ev.event_type !== "erro_emissao") {
      continue;
    }
    const payload = ev.payload_json;
    const raw = payload && typeof payload.error === "string" ? payload.error.trim() : "";
    if (!raw) {
      return "Falha na emissão. Verifique credenciais do gateway em Configurações.";
    }
    if (raw.includes("unknown ca")) {
      return "Certificado não aceito pelo Banco Inter (unknown ca). Confirme integração sandbox e credenciais.";
    }
    if (raw.includes("bad base64 decode")) {
      return "Certificado ou chave PEM inválidos no gateway. Regrave em Configurações.";
    }
    const line = raw.split("\n")[0] ?? raw;
    return line.length > 220 ? `${line.slice(0, 220)}…` : line;
  }
  return null;
}
