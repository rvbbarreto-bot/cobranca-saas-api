/** Regras de cobrança avulsa por gateway (portal multi-tenant). */

export type PortalGatewayProvider = "asaas" | "inter" | "cora" | "pagarme" | "bb" | "c6" | string;

export type PortalChargeRules = {
  provider: string;
  displayName: string;
  referenceMaxLength: number;
  referenceAlphanumericOnly: boolean;
  amountMin: number;
  amountMax: number;
  minDueOffsetDays: number;
  minDueBusinessDays: boolean;
  requiresPayer: boolean;
  /** Gateways mTLS exigem endereco completo no cadastro do cliente. */
  requiresPayerAddress: boolean;
  supportsPix: boolean;
};

const GATEWAY_DISPLAY: Record<string, string> = {
  asaas: "Asaas",
  inter: "Banco Inter",
  cora: "Cora",
  pagarme: "Pagar.me",
  bb: "Banco do Brasil",
  c6: "C6 Bank"
};

export function normalizePortalGatewayProvider(raw: string | null | undefined): string {
  return String(raw || "asaas")
    .trim()
    .toLowerCase();
}

export function getPortalChargeRules(providerRaw: string | null | undefined): PortalChargeRules {
  const provider = normalizePortalGatewayProvider(providerRaw);
  const displayName = GATEWAY_DISPLAY[provider] ?? provider;

  if (provider === "inter") {
    return {
      provider,
      displayName,
      referenceMaxLength: 80,
      referenceAlphanumericOnly: true,
      amountMin: 0.01,
      amountMax: 999_999.99,
      minDueOffsetDays: 1,
      minDueBusinessDays: true,
      requiresPayer: true,
      requiresPayerAddress: true,
      supportsPix: false
    };
  }

  if (provider === "cora") {
    return {
      provider,
      displayName,
      referenceMaxLength: 150,
      referenceAlphanumericOnly: false,
      amountMin: 0.01,
      amountMax: 999_999.99,
      minDueOffsetDays: 1,
      minDueBusinessDays: false,
      requiresPayer: true,
      requiresPayerAddress: true,
      supportsPix: true
    };
  }

  if (provider === "c6") {
    return {
      provider,
      displayName,
      referenceMaxLength: 150,
      referenceAlphanumericOnly: false,
      amountMin: 0.01,
      amountMax: 999_999.99,
      minDueOffsetDays: 1,
      minDueBusinessDays: false,
      requiresPayer: true,
      requiresPayerAddress: true,
      supportsPix: true
    };
  }

  return {
    provider,
    displayName,
    referenceMaxLength: 150,
    referenceAlphanumericOnly: false,
    amountMin: 0.01,
    amountMax: 999_999.99,
    minDueOffsetDays: 0,
    minDueBusinessDays: false,
    requiresPayer: false,
    requiresPayerAddress: false,
    supportsPix: true
  };
}

export function sanitizeChargeReference(raw: string, rules: PortalChargeRules): string {
  let s = raw
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, rules.referenceAlphanumericOnly ? "" : " ")
    .trim();
  if (rules.referenceAlphanumericOnly) {
    s = s.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  }
  return s.slice(0, rules.referenceMaxLength);
}

function parseIsoDateOnly(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) {
    return null;
  }
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) {
    return null;
  }
  return d;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Retorna a data atual como midnight local correspondente ao dia calendário
 * em America/Sao_Paulo, independente do timezone configurado no servidor.
 * Evita falso-positivo de "data passada" quando o servidor roda em UTC e o
 * usuário acessa após as 21h (horário de Brasília, que já é meia-noite UTC).
 */
function nowInBrazil(): Date {
  const brazilIso = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Sao_Paulo"
  });
  return parseIsoDateOnly(brazilIso) ?? new Date();
}

export function addCalendarDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

export function addBusinessDays(base: Date, businessDays: number): Date {
  const d = startOfLocalDay(base);
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) {
      added += 1;
    }
  }
  return d;
}

export function minDueDateIso(rules: PortalChargeRules, today = nowInBrazil()): string {
  const base = startOfLocalDay(today);
  const min =
    rules.minDueBusinessDays && rules.minDueOffsetDays > 0
      ? addBusinessDays(base, rules.minDueOffsetDays)
      : addCalendarDays(base, rules.minDueOffsetDays);
  return toIsoDateOnly(min);
}

export function defaultDueDateIso(daysAhead = 30, today = nowInBrazil()): string {
  return toIsoDateOnly(addCalendarDays(startOfLocalDay(today), daysAhead));
}

export function toIsoDateOnly(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isDueDateAllowed(iso: string, rules: PortalChargeRules, today = nowInBrazil()): boolean {
  const due = parseIsoDateOnly(iso);
  if (!due) {
    return false;
  }
  const minIso = minDueDateIso(rules, today);
  const min = parseIsoDateOnly(minIso);
  if (!min) {
    return false;
  }
  return startOfLocalDay(due).getTime() >= min.getTime();
}
