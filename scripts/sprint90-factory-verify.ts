/**
 * Fábrica — verificação E2E homolog SERPRO mock (EXEQ-FISC-090).
 * Uso: npm run verify:sprint90
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ROOT = process.cwd();

function run(cmd: string, env: NodeJS.ProcessEnv = process.env): void {
  console.log(`\n[sprint90-verify] $ ${cmd}`);
  execSync(cmd, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env }
  });
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
  if (!process.env.ENCRYPTION_KEY?.trim()) {
    process.env.ENCRYPTION_KEY = "a".repeat(64);
    console.warn("[sprint90-verify] ENCRYPTION_KEY ausente — usando chave dev local.");
  }

  await ensurePostgres();
  run("npm run migrate");
  run("npm run seed:fiscal-portal-e2e");

  run("npm run fiscal:serpro:homolog:e2e", {
    RUN_FISCAL_SERPRO_HOMOLOG_E2E: "1",
    FISCAL_GUIAS_ENABLED: "true",
    FISCAL_SERPRO_ENABLED: "true",
    FISCAL_SERPRO_MOCK: "true",
    FISCAL_SERPRO_REQUIRE_PROCURACAO: "false"
  });

  const evidenceDir = join(ROOT, "docs/evidencias/sprint-90");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, `sprint90-verify-${startedAt.replace(/[:.]/g, "-")}.json`),
    JSON.stringify(
      {
        sprint: 90,
        issue: "EXEQ-FISC-090",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        mode: "mock",
        pipeline: "CSV → TRANSMIT → RECIBO → DAS → CONCLUIDO",
        script: "npm run fiscal:serpro:homolog:e2e"
      },
      null,
      2
    )
  );

  console.log(`\n[sprint90-verify] OK — FISC-090 homolog E2E mock verificado em ${startedAt}`);
}

main().catch((err) => {
  console.error("[sprint90-verify] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
