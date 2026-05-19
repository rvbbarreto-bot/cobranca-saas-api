import "dotenv/config";
import pg from "pg";
import { databaseUrlIndicatesTls, shouldEnforceDatabaseTlsInChecks } from "../src/platform/health/database-url-tls";
import { probeDatabase } from "../src/platform/health/database-probe";

/**
 * Readiness pack (A): conexao real + extensao + tabelas minimas.
 * TLS (C): em NODE_ENV=production exige indicacao de TLS na URL salvo ALLOW_INSECURE_DATABASE_URL.
 */
async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    // eslint-disable-next-line no-console
    console.error("[check:db] Defina DATABASE_URL.");
    process.exit(1);
  }

  if (shouldEnforceDatabaseTlsInChecks() && !databaseUrlIndicatesTls(url)) {
    // eslint-disable-next-line no-console
    console.error(
      "[check:db] BLOQUEIO: DATABASE_URL nao indica TLS (sslmode=require, verify-full, verify-ca ou ssl=true). " +
        "Em dev local com Postgres sem TLS use NODE_ENV=development ou ALLOW_INSECURE_DATABASE_URL=1."
    );
    process.exit(1);
  }

  const timeoutMs = Math.min(Math.max(Number(process.env.CHECK_DB_TIMEOUT_MS) || 8000, 2000), 30_000);

  const pool = new pg.Pool({
    connectionString: url,
    max: 1,
    connectionTimeoutMillis: timeoutMs
  });

  try {
    const result = await probeDatabase(pool, timeoutMs);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.error("[check:db] FALHA:", result.error, JSON.stringify(result.checks, null, 2));
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log("[check:db] OK", { latency_ms: result.latencyMs, checks: result.checks });
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[check:db] falhou:", err);
  process.exit(1);
});
