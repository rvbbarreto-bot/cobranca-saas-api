import { getObjectStorage } from "../../../platform/storage/get-object-storage";

export function buildFiscalPdfStorageKey(
  tenantId: string,
  guiaId: string,
  versao: number
): string {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `fiscal/${safeTenant}/${guiaId}/v${versao}.pdf`;
}

export async function uploadFiscalGuiaPdf(input: {
  tenantId: string;
  guiaId: string;
  versao: number;
  pdfBytes: Buffer;
}): Promise<{ pdf_storage_key: string; pdf_url: string }> {
  const key = buildFiscalPdfStorageKey(input.tenantId, input.guiaId, input.versao);
  const storage = getObjectStorage();
  const result = await storage.putObject({
    key,
    body: input.pdfBytes,
    contentType: "application/pdf"
  });
  return { pdf_storage_key: result.key, pdf_url: result.url };
}
