import pg from "pg";
import { hashPortalPassword } from "../modules/portal-read/application/portal-password";
import { createEscritorioWithAdmin } from "../modules/exeq-platform/application/create-escritorio";

export const EXEQ_MASTER_EMAIL = "master@exeq.local";
export const EXEQ_MASTER_PASSWORD =
  process.env.SEED_EXEQ_MASTER_PASSWORD?.trim() || "ExeqMaster!2026";

export type MultiEscritorioSeedSpec = {
  slug: string;
  name: string;
  adminEmail: string;
  adminFullName: string;
  modules?: Partial<{
    cobranca: boolean;
    clientes: boolean;
    notas_fiscais: boolean;
    fiscal_guias: boolean;
    relatorios: boolean;
  }>;
};

export const MULTI_ESCRITORIO_SEEDS: MultiEscritorioSeedSpec[] = [
  {
    slug: "escritorio-atibaia",
    name: "Escritório Atibaia",
    adminEmail: "admin.atibaia@teste.local",
    adminFullName: "Admin Atibaia",
    modules: {
      cobranca: true,
      clientes: true,
      notas_fiscais: true,
      fiscal_guias: true,
      relatorios: true
    }
  },
  {
    slug: "escritorio-nazare",
    name: "Escritório Nazaré",
    adminEmail: "admin.nazare@teste.local",
    adminFullName: "Admin Nazaré",
    modules: {
      cobranca: true,
      clientes: true,
      notas_fiscais: true,
      fiscal_guias: true,
      relatorios: true
    }
  }
];

export type SeedExeqPlatformResult = {
  masterEmail: string;
  masterPasswordHint: string;
  escritorios: Array<{
    slug: string;
    name: string;
    automacaoTenantId: string;
    adminEmail: string;
  }>;
};

async function ensurePlatformMaster(client: pg.Client, passwordHash: string): Promise<void> {
  await client.query(
    `ALTER TABLE portal.app_user ADD COLUMN IF NOT EXISTS is_platform_master BOOLEAN NOT NULL DEFAULT false`
  );
  await client.query(
    `CREATE TABLE IF NOT EXISTS portal.tenant_module (
      tenant_id TEXT NOT NULL,
      module_key TEXT NOT NULL CHECK (
        module_key IN ('cobranca', 'notas_fiscais', 'fiscal_guias', 'relatorios', 'clientes')
      ),
      enabled BOOLEAN NOT NULL DEFAULT true,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (tenant_id, module_key)
    )`
  );

  await client.query(
    `INSERT INTO portal.app_user (email, full_name, password_hash, is_platform_master)
     VALUES ($1, $2, $3, true)
     ON CONFLICT (email) DO UPDATE
       SET full_name = EXCLUDED.full_name,
           password_hash = EXCLUDED.password_hash,
           is_platform_master = true,
           updated_at = now()`,
    [EXEQ_MASTER_EMAIL, "EXEQ Platform Master", passwordHash]
  );
}

async function findEscritorioBySlug(client: pg.Client, slug: string): Promise<string | null> {
  const r = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM automacao.tenants WHERE lower(trim(slug)) = lower(trim($1)) LIMIT 1`,
    [slug]
  );
  return r.rows[0]?.id ?? null;
}

/** Idempotente: master EXEQ + escritórios Atibaia/Nazaré com admin total. */
export async function runSeedExeqPlatform(connectionString: string): Promise<SeedExeqPlatformResult> {
  const client = new pg.Client({ connectionString });
  await client.connect();
  try {
    const passwordHash = await hashPortalPassword(EXEQ_MASTER_PASSWORD);
    await ensurePlatformMaster(client, passwordHash);
  } finally {
    await client.end();
  }

  const escritorios: SeedExeqPlatformResult["escritorios"] = [];
  const pool = new pg.Pool({ connectionString });

  try {
    for (const spec of MULTI_ESCRITORIO_SEEDS) {
      const check = new pg.Client({ connectionString });
      await check.connect();
      const existingId = await findEscritorioBySlug(check, spec.slug);
      await check.end();

      if (existingId) {
        escritorios.push({
          slug: spec.slug,
          name: spec.name,
          automacaoTenantId: existingId,
          adminEmail: spec.adminEmail
        });
        continue;
      }

      const created = await createEscritorioWithAdmin(pool, {
        slug: spec.slug,
        name: spec.name,
        status: "active",
        modules: spec.modules,
        admin: {
          email: spec.adminEmail,
          fullName: spec.adminFullName,
          password: EXEQ_MASTER_PASSWORD,
          role: "admin_escritorio"
        }
      });

      escritorios.push({
        slug: spec.slug,
        name: spec.name,
        automacaoTenantId: created.automacaoTenantId,
        adminEmail: spec.adminEmail
      });
    }
  } finally {
    await pool.end();
  }

  return {
    masterEmail: EXEQ_MASTER_EMAIL,
    masterPasswordHint: EXEQ_MASTER_PASSWORD,
    escritorios
  };
}
