export function isSerproMockEnabled(): boolean {
  const raw = process.env.FISCAL_SERPRO_MOCK?.trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return process.env.NODE_ENV !== "production";
}

export function isFiscalSerproEnabled(): boolean {
  const raw = process.env.FISCAL_SERPRO_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}
