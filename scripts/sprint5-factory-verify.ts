/**
 * Fábrica — verificação Sprint 5 (EXEQ-FISC-022/023/060/061 + UX).
 * Uso: npm run verify:sprint5
 */
import "dotenv/config";
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ROOT = process.cwd();
const TEST_FILES = [
  "tests/fiscal-guias/certificate-expiry-alert.test.ts",
  "tests/serpro-integra-contador/serpro-procuracao-situacao.test.ts",
  "tests/fiscal-processamento/sprint5-pipeline.integration.test.ts"
];

function run(cmd: string): void {
  console.log(`\n[sprint5-verify] $ ${cmd}`);
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

  process.env.FISCAL_GUIAS_ENABLED = "true";
  process.env.FISCAL_SERPRO_MOCK = "true";
  process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO = "true";

  for (const file of TEST_FILES) {
    console.log(`\n[sprint5-verify] ${file}`);
    const vitest = spawnSync("npx", ["vitest", "run", file, "--reporter=verbose"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, FISCAL_GUIAS_ENABLED: "true", FISCAL_SERPRO_MOCK: "true" }
    });
    if (vitest.status !== 0) process.exit(vitest.status ?? 1);
  }

  const evidenceDir = join(ROOT, "docs/evidencias/sprint-5");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, `sprint5-verify-${startedAt.replace(/[:.]/g, "-")}.json`),
    JSON.stringify({ sprint: 5, started_at: startedAt, finished_at: new Date().toISOString(), tests: TEST_FILES }, null, 2)
  );

  console.log(`\n[sprint5-verify] OK — Sprint 5 verificado em ${startedAt}`);
}

main().catch((err) => {
  console.error("[sprint5-verify] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
