import type { PoolClient } from "pg";

/** Resolve automacao.tenants id (text) a partir do UUID público (billing link). */
export async function resolveAutomacaoTenantForPublicTenant(
  publicTenantUuid: string,
  client: PoolClient
): Promise<string | null> {
  const r = await client.query<{ automacao_tenant_id: string }>(
    `SELECT automacao_tenant_id
     FROM portal.billing_tenant_link
     WHERE public_tenant_id = $1::uuid
     LIMIT 1`,
    [publicTenantUuid]
  );
  return r.rows[0]?.automacao_tenant_id ?? null;
}
