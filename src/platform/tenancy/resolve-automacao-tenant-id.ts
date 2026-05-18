import type { Pool } from "pg";
import { getPool } from "../persistence/pool";

/**
 * Resolve identificador do escritório no schema `automacao` (id em texto ou slug).
 * Usado pelo portal e rotas que não passam pelo catálogo `public.tenants`.
 */
export async function resolveAutomacaoTenantId(raw: string): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > 256) {
    return null;
  }

  let pool: Pool;
  try {
    pool = getPool();
  } catch {
    return null;
  }

  const r = await pool.query<{ id: string }>(
    `SELECT id::text AS id
     FROM automacao.tenants
     WHERE id::text = $1
        OR lower(trim(slug)) = lower(trim($1))
     ORDER BY id ASC
     LIMIT 1`,
    [trimmed]
  );
  return r.rows[0]?.id ?? null;
}
