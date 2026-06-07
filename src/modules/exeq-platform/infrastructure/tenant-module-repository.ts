import type { Client, Pool, PoolClient } from "pg";
import {
  DEFAULT_PORTAL_MODULES,
  PORTAL_MODULE_KEYS,
  type PortalModuleFlags,
  type PortalModuleKey
} from "../domain/portal-module-keys";

type DbClient = Pool | PoolClient | Client;

export async function getTenantModuleFlags(
  db: DbClient,
  tenantId: string
): Promise<PortalModuleFlags> {
  const r = await db.query<{ module_key: string; enabled: boolean }>(
    `SELECT module_key, enabled
     FROM portal.tenant_module
     WHERE tenant_id = $1`,
    [tenantId]
  );

  if (r.rows.length === 0) {
    return { ...DEFAULT_PORTAL_MODULES };
  }

  const flags = { ...DEFAULT_PORTAL_MODULES };
  for (const row of r.rows) {
    const key = row.module_key as PortalModuleKey;
    if ((PORTAL_MODULE_KEYS as readonly string[]).includes(key)) {
      flags[key] = row.enabled;
    }
  }
  return flags;
}

export async function upsertTenantModuleFlags(
  client: DbClient,
  tenantId: string,
  flags: PortalModuleFlags
): Promise<void> {
  for (const key of PORTAL_MODULE_KEYS) {
    await client.query(
      `INSERT INTO portal.tenant_module (tenant_id, module_key, enabled, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (tenant_id, module_key) DO UPDATE
         SET enabled = EXCLUDED.enabled,
             updated_at = now()`,
      [tenantId, key, flags[key]]
    );
  }
}

export async function seedDefaultTenantModules(
  client: DbClient,
  tenantId: string,
  overrides?: Partial<PortalModuleFlags>
): Promise<void> {
  const flags = { ...DEFAULT_PORTAL_MODULES, ...overrides };
  await upsertTenantModuleFlags(client, tenantId, flags);
}
