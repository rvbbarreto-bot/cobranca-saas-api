import pg from "pg";
import { hashPortalPassword } from "../modules/portal-read/application/portal-password";

/** UUID do tenant `demo` criado em `001_init_multi_tenant_rls.sql`. */
export const DEMO_PUBLIC_TENANT_UUID = "00000000-0000-4000-8000-000000000001";

export const SEED_PORTAL_EMAIL = "portal-seed@local.dev";
export const SEED_AUTOMACAO_SLUG = "escritorio-demo";

/** Senha definida no usuario seed para `POST /v1/portal/auth/login` (Sprint A). Sobrescreva com `SEED_PORTAL_PASSWORD`. */
export const SEED_PORTAL_DEFAULT_PASSWORD =
  process.env.SEED_PORTAL_PASSWORD?.trim() || "PortalSeedDev!ChangeMe1";

export type SeedPortalHappyPathResult = {
  automacaoTenantId: string;
  portalEmail: string;
  publicTenantId: string;
};

/**
 * Idempotente: garante escritorio em `automacao`, usuario portal, membership admin,
 * e `portal.billing_tenant_link` para o tenant publico `demo`.
 */
export async function runSeedPortalHappyPath(
  connectionString: string
): Promise<SeedPortalHappyPathResult> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const automacaoTenantId = await ensureAutomacaoTenant(client);
    const appUserId = await ensurePortalAppUser(client);
    await ensurePortalPasswordHash(client, appUserId);
    await ensureMembership(client, appUserId, automacaoTenantId);
    await ensureBillingLink(client, automacaoTenantId);

    return {
      automacaoTenantId,
      portalEmail: SEED_PORTAL_EMAIL,
      publicTenantId: DEMO_PUBLIC_TENANT_UUID
    };
  } finally {
    await client.end();
  }
}

async function ensureAutomacaoTenant(client: pg.Client): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id::text AS id
     FROM automacao.tenants
     WHERE lower(trim(slug)) = lower(trim($1))
     LIMIT 1`,
    [SEED_AUTOMACAO_SLUG]
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const ins = await client.query<{ id: string }>(
    `INSERT INTO automacao.tenants (slug, nome, ativo)
     VALUES ($1, $2, true)
     RETURNING id::text AS id`,
    [SEED_AUTOMACAO_SLUG, "Escritorio Demo (seed dev)"]
  );
  const id = ins.rows[0]?.id;
  if (!id) {
    throw new Error("Falha ao inserir automacao.tenants no seed.");
  }
  return id;
}

async function ensurePortalAppUser(client: pg.Client): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM portal.app_user WHERE lower(email) = lower($1) LIMIT 1`,
    [SEED_PORTAL_EMAIL]
  );
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const ins = await client.query<{ id: string }>(
    `INSERT INTO portal.app_user (email, full_name)
     VALUES ($1, $2)
     RETURNING id::text AS id`,
    [SEED_PORTAL_EMAIL, "Usuario seed portal"]
  );
  const id = ins.rows[0]?.id;
  if (!id) {
    throw new Error("Falha ao inserir portal.app_user no seed.");
  }
  return id;
}

async function ensurePortalPasswordHash(client: pg.Client, appUserId: string): Promise<void> {
  // Mesmo DDL que `db/migrations/011_portal_app_user_password_hash.sql` — evita falha se alguém rodou seed/migrate parcial.
  await client.query(
    `ALTER TABLE portal.app_user ADD COLUMN IF NOT EXISTS password_hash TEXT NULL`
  );
  const hash = await hashPortalPassword(SEED_PORTAL_DEFAULT_PASSWORD);
  await client.query(`UPDATE portal.app_user SET password_hash = $2 WHERE id = $1::uuid`, [appUserId, hash]);
}

async function ensureMembership(client: pg.Client, appUserId: string, automacaoTenantId: string): Promise<void> {
  const existing = await client.query<{ n: string }>(
    `SELECT '1' AS n FROM portal.membership
     WHERE app_user_id = $1::uuid AND tenant_id = $2 AND role = 'admin_escritorio'
     LIMIT 1`,
    [appUserId, automacaoTenantId]
  );
  if (existing.rows[0]) {
    return;
  }

  await client.query(
    `INSERT INTO portal.membership (app_user_id, tenant_id, role)
     VALUES ($1::uuid, $2, 'admin_escritorio')`,
    [appUserId, automacaoTenantId]
  );
}

async function ensureBillingLink(client: pg.Client, automacaoTenantId: string): Promise<void> {
  await client.query(
    `INSERT INTO portal.billing_tenant_link (automacao_tenant_id, public_tenant_id)
     VALUES ($1, $2::uuid)
     ON CONFLICT (automacao_tenant_id) DO UPDATE
       SET public_tenant_id = EXCLUDED.public_tenant_id`,
    [automacaoTenantId, DEMO_PUBLIC_TENANT_UUID]
  );
}
