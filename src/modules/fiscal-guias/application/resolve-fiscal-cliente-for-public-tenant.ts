import type { Pool, PoolClient } from "pg";
import { getPool } from "../../../platform/persistence/pool";

export type ResolvedFiscalCliente = {
  portalClienteId: string;
  automacaoTenantId: string;
};

/**
 * Garante que o cliente portal pertence ao escritório vinculado ao tenant público (billing link).
 */
export async function resolveFiscalClienteForPublicTenant(
  publicTenantUuid: string,
  portalClienteId: string,
  db: Pool | PoolClient = getPool()
): Promise<ResolvedFiscalCliente | null> {
  const r = await db.query<{ portal_cliente_id: string; automacao_tenant_id: string }>(
    `SELECT c.id::text AS portal_cliente_id, c.tenant_id AS automacao_tenant_id
     FROM portal.cliente c
     INNER JOIN portal.billing_tenant_link b ON b.automacao_tenant_id = c.tenant_id
     WHERE c.id = $1::uuid
       AND b.public_tenant_id = $2::uuid
     LIMIT 1`,
    [portalClienteId, publicTenantUuid]
  );
  const row = r.rows[0];
  if (!row) {
    return null;
  }
  return {
    portalClienteId: row.portal_cliente_id,
    automacaoTenantId: row.automacao_tenant_id
  };
}
