import { onlyDigits, maskCnpj, maskCpf } from "./br-tax-id";

export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function maskBrPhone(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function maskDocumento(tipo: "PF" | "PJ", raw: string): string {
  return tipo === "PF" ? maskCpf(raw) : maskCnpj(raw);
}

const NAME_ALLOWED = /^[\p{L}\p{N} ,.'\-]+$/u;

export function isValidPartyName(name: string): boolean {
  const t = name.trim();
  return t.length >= 1 && t.length <= 100 && NAME_ALLOWED.test(t);
}

export function isValidCityName(city: string): boolean {
  const t = city.trim();
  return t.length >= 1 && t.length <= 80 && /^[\p{L} \-]+$/u.test(t);
}

export function parseCurrencyBrInput(raw: string): number | null {
  const cleaned = raw.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatCurrencyBrDisplay(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Mascara digitacao moeda BRL (centavos). */
export function maskCurrencyBrInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) {
    return "";
  }
  const cents = Number(digits);
  if (!Number.isFinite(cents)) {
    return "";
  }
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export const CURRENCY_ZERO_BR = "R$ 0,00";
