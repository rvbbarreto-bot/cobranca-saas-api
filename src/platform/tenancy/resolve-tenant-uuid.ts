import type { Pool } from "pg";
import { getPool } from "../persistence/pool";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DEMO_TENANT_ID = "00000000-0000-4000-8000-000000000001";

/**
 * Resolve identificador de tenant (UUID ou slug) para UUID canonico no banco.
 * Sem DATABASE_URL e modo teste: apenas slug "demo" mapeia para UUID fixo de seed.
 */
export async function resolveTenantUuid(raw: string): Promise<string | null> {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (process.env.SKIP_DB === "true") {
    if (trimmed.toLowerCase() === "demo" || trimmed === DEMO_TENANT_ID) {
      return DEMO_TENANT_ID;
    }
    return null;
  }

  let pool: Pool;
  try {
    pool = getPool();
  } catch {
    return null;
  }

  if (UUID_RE.test(trimmed)) {
    const r = await pool.query<{ id: string }>("SELECT id::text FROM tenants WHERE id = $1::uuid", [trimmed]);
    return r.rows[0]?.id ?? null;
  }

  const r = await pool.query<{ id: string }>("SELECT id::text FROM tenants WHERE lower(slug) = lower($1)", [
    trimmed
  ]);
  return r.rows[0]?.id ?? null;
}
