import pg from "pg";
import { insertCharge } from "../modules/billing-core/infrastructure/charge-repository";
import { hashPortalPassword } from "../modules/portal-read/application/portal-password";

/** UUID do tenant `demo` criado em `001_init_multi_tenant_rls.sql`. */
export const DEMO_PUBLIC_TENANT_UUID = "00000000-0000-4000-8000-000000000001";

export const SEED_PORTAL_EMAIL = "portal-seed@local.dev";
export const SEED_AUTOMACAO_SLUG = "escritorio-demo";

/** Lock global do seed (serializa INSERT em automacao.tenants entre workers Vitest). */
const SEED_AUTOMACAO_ADVISORY_LOCK = 9_157_240_019;

/** Senha definida no usuario seed para `POST /v1/portal/auth/login` (Sprint A). Sobrescreva com `SEED_PORTAL_PASSWORD`. */
export const SEED_PORTAL_DEFAULT_PASSWORD =
  process.env.SEED_PORTAL_PASSWORD?.trim() || "PortalSeedDev!ChangeMe1";

/** Mínimo de cobranças no tenant público para o botão «Carregar mais» (page size portal = 50). */
export const SEED_PAGINATION_CHARGE_MIN = 55;

export type SeedPortalHappyPathResult = {
  automacaoTenantId: string;
  portalEmail: string;
  publicTenantId: string;
  paginationCharges: { before: number; after: number; inserted: number };
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
    const paginationCharges = await ensurePaginationCharges(client, DEMO_PUBLIC_TENANT_UUID);

    return {
      automacaoTenantId,
      portalEmail: SEED_PORTAL_EMAIL,
      publicTenantId: DEMO_PUBLIC_TENANT_UUID,
      paginationCharges
    };
  } finally {
    await client.end();
  }
}

async function ensureAutomacaoTenant(client: pg.Client): Promise<string> {
  await client.query(`SELECT pg_advisory_lock($1)`, [SEED_AUTOMACAO_ADVISORY_LOCK]);
  try {
    const existing = await client.query<{ id: string }>(
      `SELECT id::text AS id
       FROM automacao.tenants
       WHERE lower(trim(slug)) = lower(trim($1))
       ORDER BY id ASC
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
  } finally {
    await client.query(`SELECT pg_advisory_unlock($1)`, [SEED_AUTOMACAO_ADVISORY_LOCK]);
  }
}

async function ensurePortalAppUser(client: pg.Client): Promise<string> {
  const ins = await client.query<{ id: string }>(
    `INSERT INTO portal.app_user (email, full_name)
     VALUES ($1, $2)
     ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name
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
  await client.query(
    `INSERT INTO portal.membership (app_user_id, tenant_id, role)
     VALUES ($1::uuid, $2, 'admin_escritorio')
     ON CONFLICT DO NOTHING`,
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

/**
 * Garante ≥ {@link SEED_PAGINATION_CHARGE_MIN} cobranças em rascunho no tenant público demo
 * (idempotente — referências `SEED-PAG-QA-*`).
 */
async function ensurePaginationCharges(
  client: pg.Client,
  publicTenantId: string
): Promise<{ before: number; after: number; inserted: number }> {
  await client.query("BEGIN");
  try {
    await client.query(`SELECT set_config('app.tenant_id', $1, true)`, [publicTenantId]);
    const countRes = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM charges WHERE tenant_id = $1::uuid`,
      [publicTenantId]
    );
    const before = Number(countRes.rows[0]?.n ?? 0);
    if (before >= SEED_PAGINATION_CHARGE_MIN) {
      await client.query("COMMIT");
      return { before, after: before, inserted: 0 };
    }

    const need = SEED_PAGINATION_CHARGE_MIN - before;
    const baseDate = new Date();
    for (let i = 0; i < need; i++) {
      const n = before + i + 1;
      const due = new Date(baseDate);
      due.setDate(due.getDate() + 30 + (n % 120));
      await insertCharge(client, {
        reference: `SEED-PAG-QA-${String(n).padStart(4, "0")}`,
        idempotencyKey: `seed-pagination-qa-${n}`,
        amount: 10 + (n % 50),
        dueDate: due.toISOString().slice(0, 10),
        metadata: { seed: "pagination-qa" }
      });
    }

    const afterRes = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM charges WHERE tenant_id = $1::uuid`,
      [publicTenantId]
    );
    const after = Number(afterRes.rows[0]?.n ?? 0);
    await client.query("COMMIT");
    return { before, after, inserted: after - before };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  }
}
