import pg from "pg";
import { hashPortalPassword } from "../modules/portal-read/application/portal-password";
import { seedDefaultTenantModules } from "../modules/exeq-platform/infrastructure/tenant-module-repository";
import { SEED_AUTOMACAO_SLUG } from "./seed-portal-happy-path";

export const RBAC_ADMIN_EMAIL = "admin@teste.local";
export const RBAC_OPERADOR_EMAIL = "operador@teste.local";

export const RBAC_DEV_PASSWORD =
  process.env.SEED_RBAC_PASSWORD?.trim() || "TesteDev!2026";

export type SeedPortalRbacUser = {
  email: string;
  fullName: string;
  role: "admin_escritorio" | "operador";
};

export const RBAC_SEED_USERS: SeedPortalRbacUser[] = [
  { email: RBAC_ADMIN_EMAIL, fullName: "Admin Teste", role: "admin_escritorio" },
  { email: RBAC_OPERADOR_EMAIL, fullName: "Operador Teste", role: "operador" }
];

export type SeedPortalRbacResult = {
  automacaoTenantId: string;
  automacaoTenantSlug: string;
  users: Array<{ email: string; role: string; appUserId: string }>;
  passwordHint: string;
};

async function resolveAutomacaoTenantId(client: pg.Client): Promise<string> {
  const r = await client.query<{ id: string }>(
    `SELECT id::text AS id
     FROM automacao.tenants
     WHERE lower(trim(slug)) = lower(trim($1))
     LIMIT 1`,
    [SEED_AUTOMACAO_SLUG]
  );
  const id = r.rows[0]?.id;
  if (!id) {
    throw new Error(
      `Tenant automacao '${SEED_AUTOMACAO_SLUG}' ausente. Rode npm run seed:dev antes de seed:dev-rbac.`
    );
  }
  return id;
}

async function upsertPortalUser(
  client: pg.Client,
  user: SeedPortalRbacUser,
  passwordHash: string,
  automacaoTenantId: string
): Promise<string> {
  await client.query(
    `ALTER TABLE portal.app_user ADD COLUMN IF NOT EXISTS password_hash TEXT NULL`
  );

  const ins = await client.query<{ id: string }>(
    `INSERT INTO portal.app_user (email, full_name, password_hash)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           password_hash = EXCLUDED.password_hash
     RETURNING id::text AS id`,
    [user.email, user.fullName, passwordHash]
  );
  const appUserId = ins.rows[0]?.id;
  if (!appUserId) {
    throw new Error(`Falha ao upsert portal.app_user: ${user.email}`);
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
    [appUserId, automacaoTenantId, user.role]
  );

  return appUserId;
}

/** Idempotente: usuários admin + operador no tenant seed (escritorio-demo). */
export async function runSeedPortalRbacUsers(connectionString: string): Promise<SeedPortalRbacResult> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const automacaoTenantId = await resolveAutomacaoTenantId(client);
    const passwordHash = await hashPortalPassword(RBAC_DEV_PASSWORD);
    const users: SeedPortalRbacResult["users"] = [];

    for (const spec of RBAC_SEED_USERS) {
      const appUserId = await upsertPortalUser(client, spec, passwordHash, automacaoTenantId);
      users.push({ email: spec.email, role: spec.role, appUserId });
    }

    // Dev local (admin@teste.local / escritorio-demo): fiscal_guias sempre ligado.
    await seedDefaultTenantModules(client, automacaoTenantId, {
      cobranca: true,
      clientes: true,
      notas_fiscais: true,
      fiscal_guias: true,
      relatorios: true
    });

    return {
      automacaoTenantId,
      automacaoTenantSlug: SEED_AUTOMACAO_SLUG,
      users,
      passwordHint: RBAC_DEV_PASSWORD
    };
  } finally {
    await client.end();
  }
}
