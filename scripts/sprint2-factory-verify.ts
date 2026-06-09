/**
 * Fábrica — verificação Sprint 2 (EXEQ-FISC-020/021).
 * Uso: npm run verify:sprint2
 */
import "dotenv/config";
import { execSync, spawnSync } from "node:child_process";
import pg from "pg";

const ROOT = process.cwd();
const TEST_FILES = [
  "tests/fiscal-guias/sprint2-certificate-vault.integration.test.ts",
  "tests/fiscal-guias/fiscal-certificados.integration.test.ts"
];

function run(cmd: string): void {
  console.log(`\n[sprint2-verify] $ ${cmd}`);
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

  if (await dbReachable(url)) {
    console.log("[sprint2-verify] Postgres acessivel.");
    return;
  }

  run("docker info");
  run("docker compose up -d postgres");

  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await dbReachable(url)) return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Postgres indisponivel apos 90s.");
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  await ensurePostgres();

  run("npm run check:db");
  run("npm run migrate");
  run("npm run backfill:organization");
  run("npm run backfill:certificate-vault");

  for (const file of TEST_FILES) {
    console.log(`\n[sprint2-verify] Executando ${file}...`);
    const vitest = spawnSync("npx", ["vitest", "run", file, "--reporter=verbose"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true
    });
    if (vitest.status !== 0) process.exit(vitest.status ?? 1);
  }

  console.log(`\n[sprint2-verify] OK — Sprint 2 verificado em ${startedAt}`);
}

main().catch((err) => {
  console.error("[sprint2-verify] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
