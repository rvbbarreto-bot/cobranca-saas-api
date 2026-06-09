/**
 * Fábrica — verificação Sprint 10 (EXEQ-FISC-095 hardening go-live).
 * Uso: npm run verify:sprint10
 */
import "dotenv/config";
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ROOT = process.cwd();
const TEST_FILES = [
  "tests/platform/fiscal-serpro-enabled.test.ts",
  "tests/platform/fiscal-ingest-rate-limit.test.ts",
  "tests/platform/encryption-key-policy.test.ts",
  "tests/platform/fiscal-serpro-prod-env.test.ts",
  "tests/fiscal-guias/fiscal-go-live-hardening.integration.test.ts"
];

function run(cmd: string): void {
  console.log(`\n[sprint10-verify] $ ${cmd}`);
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

  for (const file of TEST_FILES) {
    console.log(`\n[sprint10-verify] ${file}`);
    const vitest = spawnSync("npx", ["vitest", "run", file, "--reporter=verbose"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        FISCAL_GUIAS_ENABLED: "true",
        FISCAL_SERPRO_MOCK: "true"
      }
    });
    if (vitest.status !== 0) process.exit(vitest.status ?? 1);
  }

  const evidenceDir = join(ROOT, "docs/evidencias/sprint-10");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, `sprint10-verify-${startedAt.replace(/[:.]/g, "-")}.json`),
    JSON.stringify(
      {
        sprint: 10,
        issue: "EXEQ-FISC-095",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        tests: TEST_FILES,
        checklist: "docs/FISCAL_GO_LIVE_CHECKLIST.md"
      },
      null,
      2
    )
  );

  console.log(`\n[sprint10-verify] OK — Sprint 10 (FISC-095) verificado em ${startedAt}`);
}

main().catch((err) => {
  console.error("[sprint10-verify] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
