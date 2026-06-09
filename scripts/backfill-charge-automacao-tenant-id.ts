/**
 * Backfill metadata.portal_automacao_tenant_id em cobranças sem o campo.
 * Uso: npm run db:query -- não; execute: npx tsx scripts/backfill-charge-automacao-tenant-id.ts
 * Requer DATABASE_URL e vínculo portal.billing_tenant_link.
 */
import "dotenv/config";
import pg from "pg";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("Defina DATABASE_URL no .env");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const links = await client.query<{ automacao_tenant_id: string; public_tenant_id: string }>(
      `SELECT automacao_tenant_id::text, public_tenant_id::text
       FROM portal.billing_tenant_link`
    );
    let total = 0;
    for (const link of links.rows) {
      const r = await client.query(
        `UPDATE charges
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb),
           '{portal_automacao_tenant_id}',
           to_jsonb($1::text),
           true
         ),
         updated_at = now()
         WHERE tenant_id = $2::uuid
           AND (metadata->>'portal_automacao_tenant_id' IS NULL
                OR trim(metadata->>'portal_automacao_tenant_id') = '')
           AND metadata->>'portal_cliente_id' IS NOT NULL
           AND trim(metadata->>'portal_cliente_id') <> ''`,
        [link.automacao_tenant_id, link.public_tenant_id]
      );
      const n = r.rowCount ?? 0;
      if (n > 0) {
        console.log(`Tenant public ${link.public_tenant_id}: ${n} cobrança(s) atualizada(s)`);
        total += n;
      }
    }
    console.log(`Total: ${total} cobrança(s) com portal_automacao_tenant_id preenchido.`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
