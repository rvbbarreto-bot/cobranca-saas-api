import type { Pool, PoolClient } from "pg";
import type { AuditRequestContext } from "../../../platform/audit/audit-context";
import { writeAuditLog } from "../../../platform/audit/audit.service";

export async function recordPortalLoginAudit(
  client: PoolClient,
  input: {
    automacaoTenantId: string;
    appUserId: string;
    audit: AuditRequestContext;
  }
): Promise<void> {
  await writeAuditLog(
    {
      tenantId: input.automacaoTenantId,
      userId: input.appUserId,
      action: "login",
      resourceType: "portal.app_user",
      resourceId: input.appUserId,
      newValue: { tenant_id: input.automacaoTenantId, email_login: true },
      ipAddress: input.audit.ipAddress,
      userAgent: input.audit.userAgent
    },
    client
  );
}

/** Login nao usa RLS de cobranca; transacao dedicada apenas para audit_log. */
export async function recordPortalLoginAuditInTransaction(
  pool: Pool,
  input: {
    automacaoTenantId: string;
    appUserId: string;
    audit: AuditRequestContext;
  }
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await recordPortalLoginAudit(client, input);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
