/**
 * Fábrica — verificação Sprint 4 (EXEQ-FISC-040/050/051/052).
 * Uso: npm run verify:sprint4
 */
import "dotenv/config";
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ROOT = process.cwd();
const TEST_FILES = [
  "tests/fiscal-processamento/processamento-status.test.ts",
  "tests/serpro-integra-contador/serpro-mock-client.test.ts",
  "tests/fiscal-processamento/sprint4-processamento.integration.test.ts"
];

function run(cmd: string): void {
  console.log(`\n[sprint4-verify] $ ${cmd}`);
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

  const results: { file: string; status: number | null }[] = [];
  for (const file of TEST_FILES) {
    console.log(`\n[sprint4-verify] ${file}`);
    const vitest = spawnSync("npx", ["vitest", "run", file, "--reporter=verbose"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, FISCAL_GUIAS_ENABLED: "true", FISCAL_SERPRO_MOCK: "true" }
    });
    results.push({ file, status: vitest.status });
    if (vitest.status !== 0) process.exit(vitest.status ?? 1);
  }

  const evidenceDir = join(ROOT, "docs/evidencias/sprint-4");
  mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = join(evidenceDir, `sprint4-verify-${startedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        sprint: 4,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        tests: results,
        env: { FISCAL_GUIAS_ENABLED: true, FISCAL_SERPRO_MOCK: true }
      },
      null,
      2
    )
  );

  console.log(`\n[sprint4-verify] OK — evidencia: ${evidencePath}`);
}

main().catch((err) => {
  console.error("[sprint4-verify] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
