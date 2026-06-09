/** Bloqueia transmissão SERPRO se procuração não validada via OBTERPROCURACAO41. */
export function isSerproProcuracaoRequired(): boolean {
  const raw = process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO?.trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return true;
}
