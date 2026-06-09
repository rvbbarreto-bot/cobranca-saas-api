/**
 * Fábrica — verificação EXEQ-FISC-053 (audit trail apuração SERPRO).
 * Uso: npm run verify:sprint53
 */
import "dotenv/config";
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ROOT = process.cwd();
const TEST_FILES = [
  "tests/fiscal-processamento/fisc-053-apuracao-audit.test.ts",
  "tests/fiscal-processamento/fisc-053-apuracao-audit.integration.test.ts"
];

function run(cmd: string): void {
  console.log(`\n[sprint53-verify] $ ${cmd}`);
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
  run("npm run migrate");
  run("npm run backfill:organization");

  for (const file of TEST_FILES) {
    console.log(`\n[sprint53-verify] ${file}`);
    const vitest = spawnSync("npx", ["vitest", "run", file, "--reporter=verbose"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        FISCAL_GUIAS_ENABLED: "true",
        FISCAL_SERPRO_MOCK: "true",
        FISCAL_SERPRO_REQUIRE_PROCURACAO: "false",
        NODE_ENV: "test"
      }
    });
    if (vitest.status !== 0) process.exit(vitest.status ?? 1);
  }

  const evidenceDir = join(ROOT, "docs/evidencias/sprint-5");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, `sprint53-verify-${startedAt.replace(/[:.]/g, "-")}.json`),
    JSON.stringify(
      {
        sprint: 5,
        issue: "EXEQ-FISC-053",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        tests: TEST_FILES,
        migration: "037_fiscal_audit_apuracao_serpro.sql"
      },
      null,
      2
    )
  );

  console.log(`\n[sprint53-verify] OK — FISC-053 verificado em ${startedAt}`);
}

main().catch((err) => {
  console.error("[sprint53-verify] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
