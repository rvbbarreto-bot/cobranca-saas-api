/** Placeholder persistido na emissão até o portal expor proxy autenticado. */
const INTER_PDF_PLACEHOLDER_RE = /^inter:\/\/cobranca\/([^/]+)\/pdf$/i;

export function isInterPdfPlaceholder(url: string | null | undefined): boolean {
  const raw = url?.trim();
  return Boolean(raw && INTER_PDF_PLACEHOLDER_RE.test(raw));
}

export function parseInterPdfCodigoSolicitacao(url: string): string | null {
  const m = url.trim().match(INTER_PDF_PLACEHOLDER_RE);
  return m?.[1]?.trim() || null;
}

export function buildInterPdfPlaceholder(codigoSolicitacao: string): string {
  return `inter://cobranca/${codigoSolicitacao.trim()}/pdf`;
}

export function portalBoletoPdfApiPath(chargeId: string): string {
  return `/v1/portal/cobrancas/${encodeURIComponent(chargeId)}/boleto.pdf`;
}
