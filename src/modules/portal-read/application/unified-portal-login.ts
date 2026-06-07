import type { Pool } from "pg";
import { signAccessToken, signPlatformMasterToken } from "../../identity-access/application/jwt-service";
import { verifyPortalPassword } from "./portal-password";
import { resolveAutomacaoTenantId } from "../../../platform/tenancy/resolve-automacao-tenant-id";
import { isAutomacaoTenantActive } from "../../exeq-platform/infrastructure/automacao-tenant-status";

export type UnifiedLoginTenantOption = {
  automacaoTenantId: string;
  slug: string | null;
  name: string | null;
  role: string;
};

export type UnifiedLoginInput = {
  email: string;
  password: string;
  tenantId?: string;
};

export type UnifiedLoginPortalSuccess = {
  kind: "portal";
  appUserId: string;
  automacaoTenantId: string;
  tenantSlug: string | null;
  accessToken: string;
  expiresIn: number;
};

export type UnifiedLoginMasterSuccess = {
  kind: "platform_master";
  appUserId: string;
  email: string;
  fullName: string | null;
  accessToken: string;
  expiresIn: number;
};

export type UnifiedLoginTenantSelection = {
  kind: "tenant_selection_required";
  tenants: UnifiedLoginTenantOption[];
};

export type UnifiedLoginResult =
  | UnifiedLoginPortalSuccess
  | UnifiedLoginMasterSuccess
  | UnifiedLoginTenantSelection
  | "invalid_credentials"
  | "password_not_set"
  | "tenant_inactive";

const PORTAL_EXPIRES_IN = 900;
const MASTER_EXPIRES_IN = 8 * 60 * 60;

async function loadUserByEmail(
  pool: Pool,
  email: string
): Promise<{
  id: string;
  email: string;
  fullName: string | null;
  passwordHash: string | null;
  isPlatformMaster: boolean;
} | null> {
  const q = await pool.query<{
    id: string;
    email: string;
    full_name: string | null;
    password_hash: string | null;
    is_platform_master: boolean;
  }>(
    `SELECT id::text AS id, email, full_name, password_hash, COALESCE(is_platform_master, false) AS is_platform_master
     FROM portal.app_user
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [email.trim()]
  );
  const row = q.rows[0];
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    passwordHash: row.password_hash,
    isPlatformMaster: row.is_platform_master
  };
}

async function listMembershipTenants(
  pool: Pool,
  appUserId: string
): Promise<UnifiedLoginTenantOption[]> {
  const q = await pool.query<{
    tenant_id: string;
    role: string;
    slug: string | null;
    name: string | null;
  }>(
    `SELECT
       m.tenant_id,
       m.role,
       t.slug,
       t.nome AS name
     FROM portal.membership m
     LEFT JOIN automacao.tenants t ON t.id::text = m.tenant_id
     WHERE m.app_user_id = $1::uuid
       AND m.role IN ('admin_escritorio', 'operador')
       AND COALESCE(t.ativo, true) = true
     ORDER BY lower(COALESCE(t.nome, t.slug, m.tenant_id))`,
    [appUserId]
  );
  return q.rows.map((row) => ({
    automacaoTenantId: row.tenant_id,
    slug: row.slug,
    name: row.name,
    role: row.role
  }));
}

async function loginPortalForAutomacaoTenant(
  pool: Pool,
  appUserId: string,
  automacaoTenantId: string
): Promise<UnifiedLoginPortalSuccess | "invalid_credentials" | "tenant_inactive"> {
  const active = await isAutomacaoTenantActive(pool, automacaoTenantId);
  if (!active) {
    return "tenant_inactive";
  }

  const q = await pool.query<{ tenant_id: string; slug: string | null }>(
    `SELECT m.tenant_id, t.slug
     FROM portal.membership m
     LEFT JOIN automacao.tenants t ON t.id::text = m.tenant_id
     WHERE m.app_user_id = $1::uuid
       AND m.tenant_id = $2
       AND m.role IN ('admin_escritorio', 'operador')
     LIMIT 1`,
    [appUserId, automacaoTenantId]
  );
  if (!q.rows[0]) {
    return "invalid_credentials";
  }

  const token = signAccessToken({
    sub: appUserId,
    tid: automacaoTenantId,
    roles: ["owner"]
  });

  return {
    kind: "portal",
    appUserId,
    automacaoTenantId,
    tenantSlug: q.rows[0].slug,
    accessToken: token,
    expiresIn: PORTAL_EXPIRES_IN
  };
}

/**
 * Login unificado: e-mail + senha; tenant opcional.
 * Master EXEQ entra sem tenant; demais usuários resolvem tenant automaticamente ou pedem seleção.
 */
export async function unifiedPortalLogin(
  pool: Pool,
  input: UnifiedLoginInput
): Promise<UnifiedLoginResult> {
  const email = input.email.trim();
  const password = input.password;
  const tenantRaw = input.tenantId?.trim() ?? "";

  if (!email || !password) {
    return "invalid_credentials";
  }

  const user = await loadUserByEmail(pool, email);
  if (!user) {
    return "invalid_credentials";
  }
  if (!user.passwordHash) {
    return "password_not_set";
  }

  const passwordOk = await verifyPortalPassword(password, user.passwordHash);
  if (!passwordOk) {
    return "invalid_credentials";
  }

  if (tenantRaw) {
    const automacaoTenantId = await resolveAutomacaoTenantId(tenantRaw);
    if (!automacaoTenantId) {
      return "invalid_credentials";
    }
    const portal = await loginPortalForAutomacaoTenant(pool, user.id, automacaoTenantId);
    if (portal === "tenant_inactive") {
      return "tenant_inactive";
    }
    if (portal === "invalid_credentials" && user.isPlatformMaster) {
      return "invalid_credentials";
    }
    return portal;
  }

  if (user.isPlatformMaster) {
    return {
      kind: "platform_master",
      appUserId: user.id,
      email: user.email,
      fullName: user.fullName,
      accessToken: signPlatformMasterToken(user.id, { expiresIn: `${MASTER_EXPIRES_IN}s` }),
      expiresIn: MASTER_EXPIRES_IN
    };
  }

  const tenants = await listMembershipTenants(pool, user.id);
  if (tenants.length === 0) {
    return "invalid_credentials";
  }
  if (tenants.length === 1) {
    const only = tenants[0]!;
    const portal = await loginPortalForAutomacaoTenant(pool, user.id, only.automacaoTenantId);
    if (portal === "tenant_inactive") {
      return "tenant_inactive";
    }
    return portal;
  }

  return {
    kind: "tenant_selection_required",
    tenants
  };
}
