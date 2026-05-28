import { addCalendarDays, parseIsoDateOnly, toIsoDateOnly } from "./gateway-charge-rules";

export const EXPORT_DATE_MIN_ISO = "2000-01-01";

export function defaultExportDateRange(today = new Date()): { from: string; to: string } {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = addCalendarDays(end, -29);
  return { from: toIsoDateOnly(start), to: toIsoDateOnly(end) };
}

export function validateExportDateRange(from: string, to: string): string | null {
  if (!from.trim() || !to.trim()) {
    return "Informe a data inicial e a data final.";
  }
  if (!parseIsoDateOnly(from) || !parseIsoDateOnly(to)) {
    return "Datas invalidas. Use o formato DD/MM/AAAA.";
  }
  if (from > to) {
    return "A data inicial nao pode ser posterior a data final.";
  }
  return null;
}
