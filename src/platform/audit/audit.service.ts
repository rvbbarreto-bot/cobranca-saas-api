import type { PoolClient } from "pg";

export interface AuditEntry {
  tenantId: string;
  userId?: string;
  action: "create" | "update" | "delete" | "cancel" | "status_change" | "login" | "manual_payment";
  resourceType: string;
  resourceId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(entry: AuditEntry, client: PoolClient): Promise<void> {
  await client.query(
    `INSERT INTO audit_log
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
