import type { Pool, PoolClient } from "pg";
import { DatabaseError } from "pg";
import { hashPortalPassword } from "../../portal-read/application/portal-password";
import { provisionPublicTenant } from "../../tenant-provisioning/application/provision-public-tenant";
import { normalizePortalModuleFlags, type PortalModuleFlags } from "../domain/portal-module-keys";
import { seedDefaultTenantModules } from "../infrastructure/tenant-module-repository";
import { ensureOrganizationForEscritorio } from "../infrastructure/organization-repository";

export type CreateEscritorioInput = {
  slug: string;
  name: string;
  status?: "trial" | "active" | "suspended";
  billingEmail?: string;
  modules?: Partial<PortalModuleFlags>;
  admin: {
    email: string;
    fullName: string;
    password: string;
    role?: "admin_escritorio" | "operador";
  };
};

export type CreateEscritorioResult = {
  automacaoTenantId: string;
  slug: string;
  name: string;
  publicTenantId: string;
  adminUserId: string;
  modules: PortalModuleFlags;
};

function isValidSlug(slug: string): boolean {
  return slug.length >= 2 && slug.length <= 64 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

export function parseCreateEscritorioBody(body: unknown):
  | { ok: true; value: CreateEscritorioInput }
  | { ok: false; message: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, message: "Body JSON obrigatorio." };
  }
  const o = body as Record<string, unknown>;
  const slug = typeof o.slug === "string" ? o.slug.trim().toLowerCase() : "";
  const name = typeof o.name === "string" ? o.name.trim() : "";
  const statusRaw = typeof o.status === "string" ? o.status.trim().toLowerCase() : "trial";
  const billingEmail =
    typeof o.billing_email === "string"
      ? o.billing_email.trim()
      : typeof o.billingEmail === "string"
        ? o.billingEmail.trim()
        : "";

  const adminObj = o.admin && typeof o.admin === "object" ? (o.admin as Record<string, unknown>) : null;
  const adminEmail = adminObj && typeof adminObj.email === "string" ? adminObj.email.trim() : "";
  const adminFullName =
    adminObj && typeof adminObj.full_name === "string"
      ? adminObj.full_name.trim()
      : adminObj && typeof adminObj.fullName === "string"
        ? adminObj.fullName.trim()
        : "";
  const adminPassword = adminObj && typeof adminObj.password === "string" ? adminObj.password : "";
  const adminRoleRaw =
    adminObj && typeof adminObj.role === "string" ? adminObj.role.trim() : "admin_escritorio";

  if (!slug || !isValidSlug(slug)) {
    return {
      ok: false,
      message: "slug invalido (2-64 chars, minusculas, hifens; ex.: escritorio-atibaia)."
    };
  }
  if (!name || name.length > 200) {
    return { ok: false, message: "name obrigatorio (max 200 caracteres)." };
  }
  const status =
    statusRaw === "active" || statusRaw === "suspended" || statusRaw === "trial" ? statusRaw : null;
  if (!status) {
    return { ok: false, message: "status deve ser trial, active ou suspended." };
  }
  if (!adminEmail || !adminEmail.includes("@")) {
    return { ok: false, message: "admin.email obrigatorio." };
  }
  if (!adminFullName) {
    return { ok: false, message: "admin.full_name obrigatorio." };
  }
  if (!adminPassword || adminPassword.length < 8) {
    return { ok: false, message: "admin.password obrigatorio (min 8 caracteres)." };
  }
  const adminRole =
    adminRoleRaw === "operador" || adminRoleRaw === "admin_escritorio" ? adminRoleRaw : null;
  if (!adminRole) {
    return { ok: false, message: "admin.role deve ser admin_escritorio ou operador." };
  }

  const modulesRaw = o.modules && typeof o.modules === "object" ? (o.modules as Partial<PortalModuleFlags>) : undefined;

  return {
    ok: true,
    value: {
      slug,
      name,
      status,
      billingEmail: billingEmail || undefined,
      modules: modulesRaw,
      admin: {
        email: adminEmail,
        fullName: adminFullName,
        password: adminPassword,
        role: adminRole
      }
    }
  };
}

async function insertAutomacaoTenant(client: PoolClient, slug: string, name: string): Promise<string> {
  const ins = await client.query<{ id: string }>(
    `INSERT INTO automacao.tenants (slug, nome, ativo)
     VALUES ($1, $2, true)
     RETURNING id::text AS id`,
    [slug, name]
  );
  const id = ins.rows[0]?.id;
  if (!id) {
    throw new Error("Falha ao criar automacao.tenants.");
  }
  return id;
}

async function upsertAdminUser(
  client: PoolClient,
  input: CreateEscritorioInput["admin"],
  automacaoTenantId: string
): Promise<string> {
  const passwordHash = await hashPortalPassword(input.password);
  const ins = await client.query<{ id: string }>(
    `INSERT INTO portal.app_user (email, full_name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           password_hash = EXCLUDED.password_hash,
           updated_at = now()
     RETURNING id::text AS id`,
    [input.email, input.fullName, passwordHash]
  );
  const appUserId = ins.rows[0]?.id;
  if (!appUserId) {
    throw new Error("Falha ao criar portal.app_user.");
  }

  await client.query(
    `DELETE FROM portal.membership
     WHERE app_user_id = $1::uuid
       AND tenant_id = $2
       AND role IN ('admin_escritorio', 'operador')`,
    [appUserId, automacaoTenantId]
  );

  await client.query(
    `INSERT INTO portal.membership (app_user_id, tenant_id, role)
     VALUES ($1::uuid, $2, $3)`,
    [appUserId, automacaoTenantId, input.role ?? "admin_escritorio"]
  );

  return appUserId;
}

export async function createEscritorioWithAdmin(
  pool: Pool,
  input: CreateEscritorioInput
): Promise<CreateEscritorioResult> {
  let automacaoTenantId: string | null = null;

  const bootstrap = await pool.connect();
  try {
    await bootstrap.query("BEGIN");
    automacaoTenantId = await insertAutomacaoTenant(bootstrap, input.slug, input.name);
    await bootstrap.query("COMMIT");
  } catch (e) {
    await bootstrap.query("ROLLBACK");
    if (e instanceof DatabaseError && e.code === "23505") {
      throw new CreateEscritorioConflictError("Slug de escritorio ja cadastrado.");
    }
    throw e;
  } finally {
    bootstrap.release();
  }

  let publicTenantId: string;
  try {
    const publicTenant = await provisionPublicTenant(pool, {
      slug: input.slug,
      name: input.name,
      status: input.status ?? "trial",
      automacaoTenantId: automacaoTenantId!,
      billingEmail: input.billingEmail
    });
    publicTenantId = publicTenant.publicTenantId;
  } catch (e) {
    await pool.query(`DELETE FROM automacao.tenants WHERE id::text = $1`, [automacaoTenantId]);
    if (e instanceof DatabaseError && e.code === "23505") {
      throw new CreateEscritorioConflictError("Slug de tenant publico ja existe.");
    }
    throw e;
  }

  const modules = normalizePortalModuleFlags(input.modules);
  const finalize = await pool.connect();
  try {
    await finalize.query("BEGIN");
    await seedDefaultTenantModules(finalize, automacaoTenantId!, modules);
    await ensureOrganizationForEscritorio(finalize, {
      automacaoTenantId: automacaoTenantId!,
      slug: input.slug,
      name: input.name
    });
    const adminUserId = await upsertAdminUser(finalize, input.admin, automacaoTenantId!);
    await finalize.query("COMMIT");
    return {
      automacaoTenantId: automacaoTenantId!,
      slug: input.slug,
      name: input.name,
      publicTenantId,
      adminUserId,
      modules
    };
  } catch (e) {
    await finalize.query("ROLLBACK");
    if (e instanceof DatabaseError && e.code === "23505") {
      throw new CreateEscritorioConflictError("E-mail de admin ja cadastrado.");
    }
    throw e;
  } finally {
    finalize.release();
  }
}

export class CreateEscritorioConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CreateEscritorioConflictError";
  }
}
