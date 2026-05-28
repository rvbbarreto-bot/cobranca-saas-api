import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const MIGRATIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

/**
 * Se a query retornar ao menos uma linha, a migration ja consta como aplicada (bootstrap de DB legado).
 */
const LEGACY_APPLIED_CHECKS: Record<string, string> = {
  "000_automacao_stub_cobranca_saas.sql": `SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'automacao' AND table_name = 'tenants' LIMIT 1`,
  "001_init_multi_tenant_rls.sql": `SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenants' LIMIT 1`,
  "004_fix_schema_portal_only.sql": `SELECT 1 FROM information_schema.schemata
    WHERE schema_name = 'portal' LIMIT 1`,
  "004_portal_web_multiescritorio.sql": `SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'portal' AND table_name = 'membership' LIMIT 1`,
  "008_portal_billing_tenant_link.sql": `SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'portal' AND table_name = 'billing_tenant_link' LIMIT 1`,
  "009_portal_cliente.sql": `SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'portal' AND table_name = 'cliente' LIMIT 1`,
  "010_webhook_inbox_processing.sql": `SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'webhook_inbox' AND column_name = 'processed_at' LIMIT 1`,
  "011_portal_app_user_password_hash.sql": `SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'portal' AND table_name = 'app_user' AND column_name = 'password_hash' LIMIT 1`,
  "014_audit_log.sql": `SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_log' LIMIT 1`,
  "015_payment_gateway_fase1.sql": `SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' LIMIT 1`,
  "016_charge_events_and_charge_type.sql": `SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'charge_events' LIMIT 1`,
  "016_notifications_regua.sql": `SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'communication_events' LIMIT 1`,
  "017_payment_gateway_raw_payload.sql": `SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'payment_transactions' AND column_name = 'raw_payload' LIMIT 1`,
  "018_notifications_regua.sql": `SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'charges' AND column_name = 'paid_at' LIMIT 1`,
  "019_automacao_tenant_slug_unique.sql": `SELECT 1 FROM pg_indexes
    WHERE schemaname = 'automacao' AND indexname = 'uq_automacao_tenants_slug' LIMIT 1`,
  "020_charges_customer_id_fk.sql": `SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'charges' AND column_name = 'customer_id' LIMIT 1`,
  "021_cliente_access_tokens.sql": `SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'cliente_access_tokens' LIMIT 1`,
  "027_portal_cliente_endereco.sql": `SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'portal' AND table_name = 'cliente' AND column_name = 'endereco_cep' LIMIT 1`
};

async function listMigrationFiles(dir: string): Promise<string[]> {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

async function getAppliedFilenames(client: pg.Client): Promise<Set<string>> {
  const r = await client.query<{ filename: string }>(
    "SELECT filename FROM public.schema_migrations"
  );
  return new Set(r.rows.map((row) => row.filename));
}

async function isLegacyCheckSatisfied(client: pg.Client, file: string): Promise<boolean> {
  const sql = LEGACY_APPLIED_CHECKS[file];
  if (!sql) {
    return false;
  }
  const r = await client.query(sql);
  return (r.rowCount ?? 0) > 0;
}

async function bootstrapLegacyMigrations(
  client: pg.Client,
  files: string[]
): Promise<number> {
  const applied = await getAppliedFilenames(client);
  if (applied.size > 0) {
    return 0;
  }

  const portal = await client.query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'portal' AND table_name = 'app_user'
     ) AS exists`
  );
  if (!portal.rows[0]?.exists) {
    return 0;
  }

  let marked = 0;
  for (const file of files) {
    if (await isLegacyCheckSatisfied(client, file)) {
      await client.query(
        `INSERT INTO public.schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING`,
        [file]
      );
      marked += 1;
      console.log("[migrate] bootstrap (legado):", file);
    }
  }
  if (marked > 0) {
    console.log(`[migrate] bootstrap: ${marked} migration(s) marcada(s) sem reexecutar SQL.`);
  }
  return marked;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("Defina DATABASE_URL para executar migrations.");
    process.exit(1);
  }

  const dir = path.join(__dirname, "..", "db", "migrations");
  const files = await listMigrationFiles(dir);

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(MIGRATIONS_TABLE_SQL);
    await bootstrapLegacyMigrations(client, files);

    const applied = await getAppliedFilenames(client);
    let ran = 0;

    for (const file of files) {
      if (applied.has(file)) {
        continue;
      }
      const migrationFile = path.join(dir, file);
      const sql = fs.readFileSync(migrationFile, "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO public.schema_migrations (filename) VALUES ($1)`,
          [file]
        );
        await client.query("COMMIT");
        console.log("[migrate] OK:", file);
        ran += 1;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    if (ran === 0) {
      console.log("[migrate] nenhuma migration pendente.");
    } else {
      console.log(`[migrate] concluido: ${ran} migration(s) aplicada(s).`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[migrate] falhou:", err);
  process.exit(1);
});
