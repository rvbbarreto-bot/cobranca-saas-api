/**
 * Homolog/dev sem gateway Receita: completa guia com valores stub após captura.
 * Nunca ligar em produção real sem revisão PO.
 */
export function isFiscalCaptureStubEnabled(): boolean {
  const raw = process.env.FISCAL_CAPTURE_STUB?.trim().toLowerCase();
  return raw === "true" || raw === "1";
}
