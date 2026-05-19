import { getPool } from "../../../platform/persistence/pool";

/**
 * UUID em `public.tenants` associado ao escritório `automacao.tenants` (id texto).
 */
export async function getPublicTenantIdForAutomacao(automacaoTenantId: string): Promise<string | null> {
  const pool = getPool();
  const r = await pool.query<{ public_tenant_id: string }>(
    `SELECT public_tenant_id::text AS public_tenant_id
     FROM portal.billing_tenant_link
     WHERE automacao_tenant_id = $1
     LIMIT 1`,
    [automacaoTenantId]
  );
  return r.rows[0]?.public_tenant_id ?? null;
}
