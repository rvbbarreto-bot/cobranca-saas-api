import { getObjectStorage } from "../../../platform/storage/get-object-storage";
import { withTenantTransaction } from "../../../platform/persistence/with-tenant-transaction";
import { writeFiscalAuditLog } from "../infrastructure/fiscal-audit.service";
import { getGuiaFiscalPdfMetaForTenant } from "../infrastructure/guia-pagamento-repository";

export async function getPortalGuiaFiscalPdfUrlUseCase(
  tenantId: string,
  guiaId: string,
  options?: { userId?: string; ipAddress?: string; userAgent?: string }
): Promise<
  | { ok: true; pdf_url: string; expires_in_seconds: number }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "pdf_unavailable" }
> {
  const expiresInSeconds = 3600;

  const meta = await withTenantTransaction(tenantId, async (client) => {
    const row = await getGuiaFiscalPdfMetaForTenant(tenantId, guiaId, client);
    if (!row) {
      return null;
    }

    await writeFiscalAuditLog(
      {
        tenantId,
        userId: options?.userId,
        action: "download_pdf",
        resourceType: "guia_fiscal",
        resourceId: guiaId,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent
      },
      client
    );

    return row;
  });

  if (!meta) {
    return { ok: false, kind: "not_found" };
  }

  if (meta.pdf_storage_key?.trim()) {
    const storage = getObjectStorage();
    const pdfUrl = await storage.getPresignedGetUrl(meta.pdf_storage_key, expiresInSeconds);
    return { ok: true, pdf_url: pdfUrl, expires_in_seconds: expiresInSeconds };
  }

  if (meta.pdf_url?.trim()) {
    return { ok: true, pdf_url: meta.pdf_url, expires_in_seconds: expiresInSeconds };
  }

  return { ok: false, kind: "pdf_unavailable" };
}
