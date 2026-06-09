/**
 * Seed idempotente para Playwright fiscal portal E2E (CI e local live).
 * - Habilita módulo fiscal_guias no tenant escritorio-demo
 * - Garante cliente portal com CNPJ do CSV template PGDASD
 */
import "dotenv/config";
import pg from "pg";
import { SEED_AUTOMACAO_SLUG } from "../src/dev/seed-portal-happy-path";
import { seedDefaultTenantModules } from "../src/modules/exeq-platform/infrastructure/tenant-module-repository";

const FISCAL_E2E_CNPJ = "00000000000191";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("[seed:fiscal-portal-e2e] Defina DATABASE_URL.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const tenant = await client.query<{ id: string }>(
      `SELECT id::text AS id
       FROM automacao.tenants
       WHERE lower(trim(slug)) = lower(trim($1))
       LIMIT 1`,
      [SEED_AUTOMACAO_SLUG]
    );
    const automacaoTenantId = tenant.rows[0]?.id;
    if (!automacaoTenantId) {
      throw new Error(`Tenant '${SEED_AUTOMACAO_SLUG}' ausente. Rode npm run seed:dev primeiro.`);
    }

    await seedDefaultTenantModules(client, automacaoTenantId, {
      cobranca: true,
      clientes: true,
      notas_fiscais: true,
      fiscal_guias: true,
      relatorios: true
    });

    await client.query(
      `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email)
       VALUES ($1, $2, 'cnpj', $3, $4)
       ON CONFLICT (tenant_id, documento) DO UPDATE
         SET nome = EXCLUDED.nome,
             email = EXCLUDED.email`,
      [automacaoTenantId, FISCAL_E2E_CNPJ, "Empresa PGDASD E2E", "pgdasd-e2e@local.dev"]
    );

    // eslint-disable-next-line no-console
    console.log("[seed:fiscal-portal-e2e] OK:", {
      automacaoTenantId,
      cnpj: FISCAL_E2E_CNPJ,
      fiscal_guias: true
    });
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[seed:fiscal-portal-e2e] falhou:", err);
  process.exit(1);
});
