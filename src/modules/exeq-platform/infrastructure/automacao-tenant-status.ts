import type { Pool, PoolClient } from "pg";

type DbClient = Pool | PoolClient;

export async function isAutomacaoTenantActive(db: DbClient, automacaoTenantId: string): Promise<boolean> {
  const r = await db.query<{ ativo: boolean }>(
    `SELECT COALESCE(ativo, true) AS ativo
     FROM automacao.tenants
     WHERE id::text = $1
     LIMIT 1`,
    [automacaoTenantId]
  );
  return r.rows[0]?.ativo !== false;
}

export async function setAutomacaoTenantActive(
  client: PoolClient,
  automacaoTenantId: string,
  active: boolean
): Promise<void> {
  await client.query(`UPDATE automacao.tenants SET ativo = $2 WHERE id::text = $1`, [
    automacaoTenantId,
    active
  ]);

  await client.query(
    `UPDATE tenants pt
     SET status = $2, updated_at = now()
     FROM portal.billing_tenant_link btl
     WHERE btl.automacao_tenant_id = $1
       AND pt.id = btl.public_tenant_id`,
    [automacaoTenantId, active ? "active" : "suspended"]
  );
}
