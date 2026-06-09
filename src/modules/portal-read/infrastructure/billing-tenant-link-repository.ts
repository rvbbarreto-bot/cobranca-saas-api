import type { PoolClient } from "pg";
import { getPool } from "../../../platform/persistence/pool";

/**
 * UUID em `public.tenants` associado ao escritório `automacao.tenants` (id texto).
 */
export async function getPublicTenantIdForAutomacaoWithClient(
  client: PoolClient,
  automacaoTenantId: string
): Promise<string | null> {
  const r = await client.query<{ public_tenant_id: string }>(
    `SELECT public_tenant_id::text AS public_tenant_id
     FROM portal.billing_tenant_link
     WHERE automacao_tenant_id = $1
     LIMIT 1`,
    [automacaoTenantId]
  );
  return r.rows[0]?.public_tenant_id ?? null;
}

/**
 * Chave de `escritorio_config` gravada pelo portal (UUID publico).
 * Fallback no id automacao para ambientes legados sem link.
 */
export async function resolveEscritorioConfigTenantId(
  client: PoolClient,
  automacaoTenantId: string
): Promise<string> {
  const publicId = await getPublicTenantIdForAutomacaoWithClient(client, automacaoTenantId);
  return publicId ?? automacaoTenantId;
}

export async function getPublicTenantIdForAutomacao(automacaoTenantId: string): Promise<string | null> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    return await getPublicTenantIdForAutomacaoWithClient(client, automacaoTenantId);
  } finally {
    client.release();
  }
}
