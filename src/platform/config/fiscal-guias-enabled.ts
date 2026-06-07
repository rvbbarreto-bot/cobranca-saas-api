/**
 * Módulo fiscal guias (DAS/DARF) — desligado por padrão para não alterar runtime homologado.
 * ADR: docs/ADR_FISCAL_GUIAS_FASE0.md
 */
export function isFiscalGuiasEnabled(): boolean {
  const raw = process.env.FISCAL_GUIAS_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}
