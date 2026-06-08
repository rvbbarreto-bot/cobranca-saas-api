/** PDF mínimo válido para mocks de recibo/DAS em homologação. */
export function buildMockSerproPdfBytes(label: string): Buffer {
  const text = `%PDF-1.4 mock ${label} ${new Date().toISOString()}`;
  return Buffer.from(text, "utf8");
}

export function extractSerproPdfBytes(rawBody: unknown): Buffer | null {
  if (typeof rawBody !== "object" || rawBody === null) return null;
  const body = rawBody as Record<string, unknown>;
  if (typeof body.pdfBase64 === "string" && body.pdfBase64.length > 0) {
    return Buffer.from(body.pdfBase64, "base64");
  }
  if (typeof body.pdf === "string" && body.pdf.length > 0) {
    return Buffer.from(body.pdf, "base64");
  }
  return null;
}

export type SerproDasMockPayload = {
  linhaDigitavel?: string;
  valorPrincipal?: number;
  valorMulta?: number;
  valorJuros?: number;
  dataVencimento?: string;
};

export function extractSerproDasPayload(rawBody: unknown): SerproDasMockPayload {
  if (typeof rawBody !== "object" || rawBody === null) return {};
  const body = rawBody as Record<string, unknown>;
  return {
    linhaDigitavel:
      typeof body.linhaDigitavel === "string"
        ? body.linhaDigitavel
        : typeof body.linha_digitavel === "string"
          ? body.linha_digitavel
          : undefined,
    valorPrincipal: typeof body.valorPrincipal === "number" ? body.valorPrincipal : undefined,
    valorMulta: typeof body.valorMulta === "number" ? body.valorMulta : undefined,
    valorJuros: typeof body.valorJuros === "number" ? body.valorJuros : undefined,
    dataVencimento:
      typeof body.dataVencimento === "string"
        ? body.dataVencimento
        : typeof body.data_vencimento === "string"
          ? body.data_vencimento
          : undefined
  };
}
