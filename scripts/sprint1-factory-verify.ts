/**
 * Fábrica — verificação Sprint 1 (EXEQ-FISC-010/011/012).
 * Sobe Postgres via Docker se necessário, migrate, backfill e testes integração.
 *
 * Uso: npm run verify:sprint1
 */
import "dotenv/config";
import { execSync, spawnSync } from "node:child_process";
import pg from "pg";

const ROOT = process.cwd();
const TEST_FILE = "tests/fiscal-guias/sprint1-organization-serpro.integration.test.ts";

function run(cmd: string, opts?: { allowFail?: boolean }): number {
  console.log(`\n[sprint1-verify] $ ${cmd}`);
  try {
    execSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
    return 0;
  } catch {
    if (opts?.allowFail) return 1;
    throw new Error(`Comando falhou: ${cmd}`);
  }
}

async function dbReachable(url: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function ensurePostgres(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL ausente. Copie .env.example para .env");
  }

  if (await dbReachable(url)) {
    console.log("[sprint1-verify] Postgres acessivel.");
    return;
  }

  console.log("[sprint1-verify] Postgres indisponivel — tentando docker compose up postgres...");
  run("docker info");
  run("docker compose up -d postgres");

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await dbReachable(url)) {
      console.log("[sprint1-verify] Postgres healthy.");
      return;
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Postgres nao ficou acessivel em 90s. Verifique Docker Desktop.");
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  await ensurePostgres();

  run("npm run check:db");
  run("npm run migrate");
  run("npm run backfill:organization");

  console.log(`\n[sprint1-verify] Executando ${TEST_FILE}...`);
  const vitest = spawnSync(
    "npx",
    ["vitest", "run", TEST_FILE, "--reporter=verbose"],
    { cwd: ROOT, stdio: "inherit", shell: true }
  );

  if (vitest.status !== 0) {
    process.exit(vitest.status ?? 1);
  }

  console.log(`\n[sprint1-verify] OK — Sprint 1 verificado em ${startedAt}`);
}

main().catch((err) => {
  console.error("[sprint1-verify] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
