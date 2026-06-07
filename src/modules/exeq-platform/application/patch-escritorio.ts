import type { Pool, PoolClient } from "pg";
import { DatabaseError } from "pg";
import { hashPortalPassword } from "../../portal-read/application/portal-password";
import {
  normalizePortalModuleFlags,
  PORTAL_MODULE_KEYS,
  type PortalModuleFlags
} from "../domain/portal-module-keys";
import { setAutomacaoTenantActive } from "../infrastructure/automacao-tenant-status";
import {
  getTenantModuleFlags,
  upsertTenantModuleFlags
} from "../infrastructure/tenant-module-repository";

export type PatchEscritorioPrimaryAdmin = {
  appUserId: string;
  email?: string;
  fullName?: string;
  password?: string;
};

export type PatchEscritorioInput = {
  name?: string;
  active?: boolean;
  modules?: Partial<PortalModuleFlags>;
  primaryAdmin?: PatchEscritorioPrimaryAdmin;
};

export type PatchEscritorioResult = {
  automacaoTenantId: string;
  name: string | null;
  active: boolean;
  modules: PortalModuleFlags;
};

export function parsePatchEscritorioBody(body: unknown):
  | { ok: true; value: PatchEscritorioInput }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body JSON obrigatorio." };
  }
  const o = body as Record<string, unknown>;
  const out: PatchEscritorioInput = {};
  let found = false;

  if (typeof o.name === "string") {
    const name = o.name.trim();
    if (!name || name.length > 200) {
      return { ok: false, message: "name invalido (1-200 caracteres)." };
    }
    out.name = name;
    found = true;
  }

  if (typeof o.active === "boolean") {
    out.active = o.active;
    found = true;
  }

  const modulesRaw =
    o.modules && typeof o.modules === "object" ? (o.modules as Record<string, unknown>) : null;
  if (modulesRaw) {
    const partial: Partial<PortalModuleFlags> = {};
    for (const key of PORTAL_MODULE_KEYS) {
      if (typeof modulesRaw[key] === "boolean") {
        partial[key] = modulesRaw[key];
      }
    }
    if (Object.keys(partial).length > 0) {
      out.modules = partial;
      found = true;
    }
  }

  const adminRaw =
    o.primary_admin && typeof o.primary_admin === "object"
      ? (o.primary_admin as Record<string, unknown>)
      : o.primaryAdmin && typeof o.primaryAdmin === "object"
        ? (o.primaryAdmin as Record<string, unknown>)
        : null;
  if (adminRaw) {
    const appUserId =
      typeof adminRaw.app_user_id === "string"
        ? adminRaw.app_user_id.trim()
        : typeof adminRaw.appUserId === "string"
          ? adminRaw.appUserId.trim()
          : "";
    if (!appUserId) {
      return { ok: false, message: "primary_admin.app_user_id obrigatorio." };
    }
    const email = typeof adminRaw.email === "string" ? adminRaw.email.trim() : undefined;
    const fullName =
      typeof adminRaw.full_name === "string"
        ? adminRaw.full_name.trim()
        : typeof adminRaw.fullName === "string"
          ? adminRaw.fullName.trim()
          : undefined;
    const password = typeof adminRaw.password === "string" ? adminRaw.password : undefined;
    if (email !== undefined && (!email.includes("@") || email.length > 254)) {
      return { ok: false, message: "primary_admin.email invalido." };
    }
    if (password !== undefined && password.length > 0 && password.length < 8) {
      return { ok: false, message: "primary_admin.password min 8 caracteres." };
    }
    if (!email && !fullName && !password) {
      return { ok: false, message: "Informe email, full_name ou password do admin." };
    }
    out.primaryAdmin = { appUserId, email, fullName, password };
    found = true;
  }

  if (!found) {
    return { ok: false, message: "Informe ao menos um campo para atualizar." };
  }
  return { ok: true, value: out };
}

async function updatePrimaryAdmin(
  client: PoolClient,
  automacaoTenantId: string,
  admin: PatchEscritorioPrimaryAdmin
): Promise<void> {
  const mem = await client.query<{ id: string }>(
    `SELECT m.id::text AS id
     FROM portal.membership m
     WHERE m.app_user_id = $1::uuid
       AND m.tenant_id = $2
       AND m.role = 'admin_escritorio'
     LIMIT 1`,
    [admin.appUserId, automacaoTenantId]
  );
  if (!mem.rows[0]) {
    throw new EscritorioAdminNotFoundError();
  }

  const sets: string[] = [];
  const params: unknown[] = [admin.appUserId];
  let idx = 2;

  if (admin.fullName) {
    sets.push(`full_name = $${idx++}`);
    params.push(admin.fullName);
  }
  if (admin.email) {
    sets.push(`email = $${idx++}`);
    params.push(admin.email);
  }
  if (admin.password && admin.password.length >= 8) {
    const hash = await hashPortalPassword(admin.password);
    sets.push(`password_hash = $${idx++}`);
    params.push(hash);
  }

  if (sets.length === 0) {
    return;
  }

  sets.push("updated_at = now()");
  await client.query(
    `UPDATE portal.app_user SET ${sets.join(", ")} WHERE id = $1::uuid`,
    params
  );
}

export async function patchEscritorio(
  pool: Pool,
  automacaoTenantId: string,
  input: PatchEscritorioInput
): Promise<PatchEscritorioResult> {
  const exists = await pool.query<{ nome: string | null; ativo: boolean }>(
    `SELECT nome, COALESCE(ativo, true) AS ativo FROM automacao.tenants WHERE id::text = $1 LIMIT 1`,
    [automacaoTenantId]
  );
  if (!exists.rows[0]) {
    throw new EscritorioNotFoundError();
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (input.name !== undefined) {
      await client.query(`UPDATE automacao.tenants SET nome = $2 WHERE id::text = $1`, [
        automacaoTenantId,
        input.name
      ]);
      await client.query(
        `UPDATE tenants pt
         SET name = $2, updated_at = now()
         FROM portal.billing_tenant_link btl
         WHERE btl.automacao_tenant_id = $1 AND pt.id = btl.public_tenant_id`,
        [automacaoTenantId, input.name]
      );
    }

    if (input.active !== undefined) {
      await setAutomacaoTenantActive(client, automacaoTenantId, input.active);
    }

    if (input.modules) {
      const current = await getTenantModuleFlags(client, automacaoTenantId);
      const merged = normalizePortalModuleFlags({ ...current, ...input.modules });
      await upsertTenantModuleFlags(client, automacaoTenantId, merged);
    }

    if (input.primaryAdmin) {
      await updatePrimaryAdmin(client, automacaoTenantId, input.primaryAdmin);
    }

    await client.query("COMMIT");

    const refreshed = await pool.query<{ nome: string | null; ativo: boolean }>(
      `SELECT nome, COALESCE(ativo, true) AS ativo FROM automacao.tenants WHERE id::text = $1`,
      [automacaoTenantId]
    );
    const modules = await getTenantModuleFlags(pool, automacaoTenantId);
    const row = refreshed.rows[0]!;

    return {
      automacaoTenantId,
      name: row.nome,
      active: row.ativo !== false,
      modules
    };
  } catch (e) {
    await client.query("ROLLBACK");
    if (e instanceof DatabaseError && e.code === "23505") {
      throw new EscritorioConflictError("E-mail de admin ja cadastrado.");
    }
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

export class EscritorioAdminNotFoundError extends Error {
  constructor() {
    super("Admin do escritorio nao encontrado.");
    this.name = "EscritorioAdminNotFoundError";
  }
}

export class EscritorioConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EscritorioConflictError";
  }
}
