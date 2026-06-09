import type { Pool } from "pg";
import {
  normalizePortalModuleFlags,
  PORTAL_MODULE_KEYS,
  type PortalModuleFlags
} from "../domain/portal-module-keys";
import {
  getTenantModuleFlags,
  upsertTenantModuleFlags
} from "../infrastructure/tenant-module-repository";

export function parseUpdateEscritorioModulesBody(body: unknown):
  | { ok: true; value: Partial<PortalModuleFlags> }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body JSON obrigatorio." };
  }
  const o = body as Record<string, unknown>;
  const modulesRaw =
    o.modules && typeof o.modules === "object" ? (o.modules as Record<string, unknown>) : o;
  const partial: Partial<PortalModuleFlags> = {};
  let found = false;
  for (const key of PORTAL_MODULE_KEYS) {
    if (typeof modulesRaw[key] === "boolean") {
      partial[key] = modulesRaw[key];
      found = true;
    }
  }
  if (!found) {
    return { ok: false, message: "Informe ao menos um modulo booleano (ex.: modules.cobranca)." };
  }
  return { ok: true, value: partial };
}

export async function updateEscritorioModules(
  pool: Pool,
  automacaoTenantId: string,
  partial: Partial<PortalModuleFlags>
): Promise<PortalModuleFlags> {
  const client = await pool.connect();
  try {
    const exists = await client.query(`SELECT 1 FROM automacao.tenants WHERE id::text = $1 LIMIT 1`, [
      automacaoTenantId
    ]);
    if (!exists.rows[0]) {
      throw new EscritorioNotFoundError();
    }

    const fromDb = await getTenantModuleFlags(client, automacaoTenantId);
    const merged = normalizePortalModuleFlags({ ...fromDb, ...partial });

    await client.query("BEGIN");
    await upsertTenantModuleFlags(client, automacaoTenantId, merged);
    await client.query("COMMIT");
    return merged;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export class EscritorioNotFoundError extends Error {
  constructor() {
    super("Escritorio nao encontrado.");
    this.name = "EscritorioNotFoundError";
  }
}
