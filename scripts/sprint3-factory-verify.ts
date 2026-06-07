/**
 * Fábrica — verificação Sprint 3 (EXEQ-FISC-030/031/032).
 * Uso: npm run verify:sprint3
 */
import "dotenv/config";
import { execSync, spawnSync } from "node:child_process";
import pg from "pg";

const ROOT = process.cwd();
const TEST_FILES = [
  "tests/fiscal-ingestion/csv-ingestion-adapter.test.ts",
  "tests/fiscal-ingestion/sprint3-csv-ingest.integration.test.ts"
];

function run(cmd: string): void {
  console.log(`\n[sprint3-verify] $ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
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
  if (!url) throw new Error("DATABASE_URL ausente.");
  if (await dbReachable(url)) return;
  run("docker info");
  run("docker compose up -d postgres");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await dbReachable(url)) return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Postgres indisponivel.");
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  await ensurePostgres();
  run("npm run check:db");
  run("npm run migrate");
  run("npm run backfill:organization");

  for (const file of TEST_FILES) {
    console.log(`\n[sprint3-verify] ${file}`);
    const vitest = spawnSync("npx", ["vitest", "run", file, "--reporter=verbose"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true
    });
    if (vitest.status !== 0) process.exit(vitest.status ?? 1);
  }

  console.log(`\n[sprint3-verify] OK — Sprint 3 verificado em ${startedAt}`);
}

main().catch((err) => {
  console.error("[sprint3-verify] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
