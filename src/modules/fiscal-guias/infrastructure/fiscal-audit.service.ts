import type { PoolClient } from "pg";

export type FiscalAuditAction =
  | "download_pdf"
  | "consulta_guia"
  | "status_change"
  | "upload_certificado"
  | "admin_access"
  | "guia_disponibilizada"
  | "compliance_bloqueio"
  | "capture_requested"
  | "capture_failed";

export type FiscalAuditEntry = {
  tenantId: string;
  userId?: string;
  action: FiscalAuditAction;
  resourceType: string;
  resourceId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

export async function writeFiscalAuditLog(entry: FiscalAuditEntry, client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO fiscal.audit_log
     (tenant_id, user_id, action, resource_type, resource_id, old_value, new_value, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      entry.tenantId,
      entry.userId ?? null,
      entry.action,
      entry.resourceType,
      entry.resourceId,
      entry.oldValue ? JSON.stringify(entry.oldValue) : null,
      entry.newValue ? JSON.stringify(entry.newValue) : null,
      entry.ipAddress ?? null,
      entry.userAgent ?? null
    ]
  );
}
