import type { PoolClient } from "pg";

export type GatewayChangeLogRow = {
  id: string;
  tenant_id: string;
  old_provider: string | null;
  new_provider: string;
  changed_by_user_id: string | null;
  changed_at: Date;
  metadata: Record<string, unknown>;
};

export async function insertGatewayChangeLog(
  client: PoolClient,
  input: {
    tenantId: string;
    oldProvider: string | null;
    newProvider: string;
    changedByUserId?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO gateway_change_log (tenant_id, old_provider, new_provider, changed_by_user_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      input.tenantId,
      input.oldProvider,
      input.newProvider,
      input.changedByUserId ?? null,
      JSON.stringify(input.metadata ?? {})
    ]
  );
}

export async function listGatewayChangeLog(
  client: PoolClient,
  tenantId: string,
  limit = 20
): Promise<GatewayChangeLogRow[]> {
  const r = await client.query<GatewayChangeLogRow>(
    `SELECT id::text, tenant_id, old_provider, new_provider, changed_by_user_id,
            changed_at, metadata
     FROM gateway_change_log
     WHERE tenant_id = $1
     ORDER BY changed_at DESC
     LIMIT $2`,
    [tenantId, limit]
  );
  return r.rows;
}
