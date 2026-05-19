import "dotenv/config";
import pg from "pg";
import { processPendingWebhooksForTenant } from "../src/modules/inbox/application/process-webhook-inbox";
import { closePool } from "../src/platform/persistence/pool";

/**
 * Job para n8n / cron: processa `webhook_inbox` pendente por tenant (UUID em public.tenants).
 *
 * Variáveis:
 * - DATABASE_URL (obrigatório)
 * - WEBHOOK_PROCESS_TENANT_IDS — lista separada por vírgula de UUIDs; se vazia, todos os tenants `status = 'active'`
 * - WEBHOOK_PROCESS_LIMIT — limite por tenant (default 25, máx. 100)
 */
async function listTenantIds(client: pg.Client): Promise<string[]> {
  const raw = process.env.WEBHOOK_PROCESS_TENANT_IDS?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  const r = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM tenants WHERE status = 'active' ORDER BY slug`
  );
  return r.rows.map((row) => row.id);
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("[job:webhook-inbox] Defina DATABASE_URL.");
    process.exit(1);
  }

  const limit = Math.min(Number(process.env.WEBHOOK_PROCESS_LIMIT) || 25, 100);
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const tenantIds = await listTenantIds(client);
    if (tenantIds.length === 0) {
      console.log("[job:webhook-inbox] Nenhum tenant para processar.");
      return;
    }

    for (const tid of tenantIds) {
      try {
        const result = await processPendingWebhooksForTenant(tid, limit);
        console.log("[job:webhook-inbox] tenant", tid, JSON.stringify(result));
      } catch (err) {
        console.error("[job:webhook-inbox] falha tenant", tid, err);
        process.exitCode = 1;
      }
    }
  } finally {
    await client.end();
    await closePool();
  }
}

main().catch((err) => {
  console.error("[job:webhook-inbox]", err);
  process.exit(1);
});
