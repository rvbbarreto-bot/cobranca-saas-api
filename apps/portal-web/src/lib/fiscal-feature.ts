/** Exibe menu fiscal quando VITE_FISCAL_GUIAS_ENABLED=true (alinhado à API). */
export function isFiscalGuiasNavEnabled(): boolean {
  const raw = import.meta.env.VITE_FISCAL_GUIAS_ENABLED?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}
