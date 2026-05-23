/** URLs utilizáveis no portal (http/https). Ignora placeholders tipo inter:// */
export function isUsableHttpUrl(url: string | null | undefined): boolean {
  const raw = url?.trim();
  if (!raw) {
    return false;
  }
  if (raw.startsWith("/v1/portal/cobrancas/") && raw.endsWith("/boleto.pdf")) {
    return true;
  }
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Abre PDF via proxy autenticado do portal (Inter). */
export async function openPortalChargeBoletoPdf(
  pdfPath: string,
  fetchPdf: (path: string) => Promise<Blob>
): Promise<void> {
  const blob = await fetchPdf(pdfPath);
  const objectUrl = URL.createObjectURL(blob);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
