/**
 * Remove credenciais do portal (Configurações) + dados de teste Inter.
 * Limpa: gateway, WhatsApp, gateway_change_log, cobranças do tenant demo, cache Redis.
 *
 * Uso: npm run qa:inter-reset-credentials
 * Env: DATABASE_URL, REDIS_URL (opcional)
 */
import "dotenv/config";
import pg from "pg";
import { connectRedis } from "../src/platform/persistence/redis.js";

const PUBLIC_TENANT = process.env.QA_PORTAL_TENANT_ID?.trim() || "00000000-0000-4000-8000-000000000001";

async function clearRedisPatterns(patterns: string[]): Promise<Record<string, number>> {
  const redis = await connectRedis();
  const removed: Record<string, number> = {};
  if (!redis) {
    console.log("[reset] Redis indisponivel — pulando limpeza de cache.");
    return removed;
  }
  for (const pattern of patterns) {
    const keys: string[] = [];
    for await (const key of redis.scanIterator({ MATCH: pattern, COUNT: 100 })) {
      const k = typeof key === "string" ? key : String(key);
      if (k) {
        keys.push(k);
      }
    }
    if (keys.length > 0) {
      await redis.sendCommand(["DEL", ...keys]);
    }
    removed[pattern] = keys.length;
  }
  return removed;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("Defina DATABASE_URL no .env");
  }

  const pool = new pg.Pool({ connectionString: url });
  try {
    const before = await pool.query<{
      gw: boolean;
      wa: boolean;
      provider: string | null;
    }>(
      `SELECT
         (gateway_credentials_encrypted IS NOT NULL OR gateway_api_key_encrypted IS NOT NULL) AS gw,
         whatsapp_token_encrypted IS NOT NULL AS wa,
         gateway_provider AS provider
       FROM escritorio_config WHERE tenant_id = $1`,
      [PUBLIC_TENANT]
    );

    const chargesBefore = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM charges WHERE tenant_id = $1`,
      [PUBLIC_TENANT]
    );

    await pool.query(`BEGIN`);

    await pool.query(
      `DELETE FROM payment_transactions
       WHERE charge_id IN (SELECT id FROM charges WHERE tenant_id = $1)`,
      [PUBLIC_TENANT]
    );

    await pool.query(
      `DELETE FROM nfse_emissions
       WHERE charge_id IN (SELECT id FROM charges WHERE tenant_id = $1)`,
      [PUBLIC_TENANT]
    );

    const delCharges = await pool.query(
      `DELETE FROM charges WHERE tenant_id = $1 RETURNING id`,
      [PUBLIC_TENANT]
    );

    await pool.query(`DELETE FROM gateway_change_log WHERE tenant_id = $1`, [PUBLIC_TENANT]);

    await pool.query(
      `UPDATE escritorio_config SET
         gateway_provider = NULL,
         gateway_credentials_encrypted = NULL,
         gateway_api_key_encrypted = NULL,
         whatsapp_provider = NULL,
         whatsapp_token_encrypted = NULL,
         encryption_iv = NULL,
         updated_at = now()
       WHERE tenant_id = $1`,
      [PUBLIC_TENANT]
    );

    await pool.query(`COMMIT`);

    const redisRemoved = await clearRedisPatterns(["gw_token:inter:*", "cert_upload:*"]);

    const after = await pool.query<{
      gw: boolean;
      wa: boolean;
      provider: string | null;
    }>(
      `SELECT
         (gateway_credentials_encrypted IS NOT NULL OR gateway_api_key_encrypted IS NOT NULL) AS gw,
         whatsapp_token_encrypted IS NOT NULL AS wa,
         gateway_provider AS provider
       FROM escritorio_config WHERE tenant_id = $1`,
      [PUBLIC_TENANT]
    );

    console.log("\n=== Reset Configuracoes + Inter (homolog) ===\n");
    console.log(`Tenant publico: ${PUBLIC_TENANT}`);
    console.log(`Antes — gateway creds: ${before.rows[0]?.gw ? "SIM" : "NAO"} | provider: ${before.rows[0]?.provider ?? "(null)"} | WhatsApp token: ${before.rows[0]?.wa ? "SIM" : "NAO"}`);
    console.log(`Cobrancas removidas: ${delCharges.rowCount ?? 0} (tinha ${chargesBefore.rows[0]?.n ?? "0"})`);
    console.log(`Depois — gateway creds: ${after.rows[0]?.gw ? "SIM" : "NAO"} | provider: ${after.rows[0]?.provider ?? "(null)"} | WhatsApp token: ${after.rows[0]?.wa ? "SIM" : "NAO"}`);
    console.log("Redis removido:", redisRemoved);
    console.log("\nPortal /configuracoes deve abrir em modo edicao sem credenciais mascaradas.");
    console.log("Proximo passo: upload certificado + PATCH gateway com pacote Inter alinhado.\n");
  } catch (err) {
    await pool.query(`ROLLBACK`).catch(() => undefined);
    throw err;
  } finally {
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
