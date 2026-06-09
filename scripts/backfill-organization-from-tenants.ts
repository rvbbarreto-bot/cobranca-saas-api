/**
 * Backfill portal.organization a partir de automacao.tenants (EXEQ-FISC-010).
 * Idempotente — seguro reexecutar.
 *
 * Uso: npm run backfill:organization
 */
import "dotenv/config";
import pg from "pg";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL obrigatório.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    const check = await client.query<{ ok: boolean }>(
      `SELECT to_regclass('portal.organization') IS NOT NULL AS ok`
    );
    if (!check.rows[0]?.ok) {
      console.error("Execute npm run migrate (032_organization_and_serpro_config.sql) primeiro.");
      process.exit(1);
    }

    const tenants = await client.query<{ id: string; slug: string | null; nome: string | null }>(
      `SELECT id::text AS id, slug, nome FROM automacao.tenants ORDER BY id`
    );

    let created = 0;
    let linked = 0;

    for (const t of tenants.rows) {
      const slug = (t.slug || `tenant-${t.id}`).trim().toLowerCase();
      const name = (t.nome || t.slug || `Escritório ${t.id}`).trim();

      const orgIns = await client.query<{ id: string }>(
        `INSERT INTO portal.organization (slug, name, type, status)
         VALUES ($1, $2, 'escritorio', 'active')
         ON CONFLICT (slug) DO UPDATE SET updated_at = now()
         RETURNING id::text AS id`,
        [slug, name]
      );
      const orgId = orgIns.rows[0]?.id;
      if (!orgId) continue;

      const linkIns = await client.query(
        `INSERT INTO portal.organization_tenant (organization_id, automacao_tenant_id)
         VALUES ($1::uuid, $2)
         ON CONFLICT (automacao_tenant_id) DO NOTHING`,
        [orgId, t.id]
      );
      if ((linkIns.rowCount ?? 0) > 0) linked++;
      else created++;
    }

    console.log(`Backfill OK — tenants: ${tenants.rowCount}, links novos: ${linked}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
