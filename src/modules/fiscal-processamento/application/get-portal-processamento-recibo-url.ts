import { getPool } from "../../../platform/persistence/pool";
import { getObjectStorage } from "../../../platform/storage/get-object-storage";
import { withTenantTransaction } from "../../../platform/persistence/with-tenant-transaction";
import { writeFiscalAuditLog } from "../../fiscal-guias/infrastructure/fiscal-audit.service";
import { getProcessamentoById } from "../infrastructure/processamento-fiscal-repository";

export async function getPortalProcessamentoReciboUrlUseCase(
  tenantId: string,
  processamentoId: string,
  options?: { userId?: string; ipAddress?: string; userAgent?: string }
): Promise<
  | { ok: true; pdf_url: string; expires_in_seconds: number }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "recibo_unavailable" }
> {
  const expiresInSeconds = 3600;
  const proc = await getProcessamentoById(getPool(), tenantId, processamentoId);
  if (!proc) {
    return { ok: false, kind: "not_found" };
  }
  const reciboKey = proc.reciboStorageKey?.trim();
  if (!reciboKey) {
    return { ok: false, kind: "recibo_unavailable" };
  }

  await withTenantTransaction(tenantId, async (client) => {
    await writeFiscalAuditLog(
      {
        tenantId,
        userId: options?.userId,
        action: "download_pdf",
        resourceType: "processamento_recibo",
        resourceId: processamentoId,
        ipAddress: options?.ipAddress,
        userAgent: options?.userAgent
      },
      client
    );
  });

  const storage = getObjectStorage();
  const pdfUrl = await storage.getPresignedGetUrl(reciboKey, expiresInSeconds);
  return { ok: true, pdf_url: pdfUrl, expires_in_seconds: expiresInSeconds };
}
