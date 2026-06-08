import { getObjectStorage } from "../../../platform/storage/get-object-storage";

export function buildFiscalReciboStorageKey(tenantId: string, processamentoId: string): string {
  const safeTenant = tenantId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `fiscal/${safeTenant}/recibo/${processamentoId}.pdf`;
}

export async function uploadFiscalReciboPdf(input: {
  tenantId: string;
  processamentoId: string;
  pdfBytes: Buffer;
}): Promise<{ recibo_storage_key: string }> {
  const key = buildFiscalReciboStorageKey(input.tenantId, input.processamentoId);
  const storage = getObjectStorage();
  await storage.putObject({
    key,
    body: input.pdfBytes,
    contentType: "application/pdf"
  });
  return { recibo_storage_key: key };
}
