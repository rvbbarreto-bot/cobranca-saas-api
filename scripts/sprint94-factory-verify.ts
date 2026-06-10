/**
 * Fábrica — verificação Sprint 10 SLI fiscal (EXEQ-FISC-094).
 * Uso: npm run verify:sprint94
 */
import "dotenv/config";
import { execSync, spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const TEST_FILES = ["tests/platform/fiscal-sli-metrics.test.ts"];

function run(cmd: string): void {
  console.log(`\n[sprint94-verify] $ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();

  for (const file of TEST_FILES) {
    console.log(`\n[sprint94-verify] ${file}`);
    const vitest = spawnSync("npx", ["vitest", "run", file, "--reporter=verbose"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
      env: { ...process.env, FISCAL_GUIAS_ENABLED: "true" }
    });
    if (vitest.status !== 0) process.exit(vitest.status ?? 1);
  }

  const evidenceDir = join(ROOT, "docs/evidencias/sprint-10");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, `sprint94-verify-${startedAt.replace(/[:.]/g, "-")}.json`),
    JSON.stringify(
      {
        sprint: 10,
        issue: "EXEQ-FISC-094",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        tests: TEST_FILES,
        sli_doc: "docs/observability/sli-fiscal-definitions.md",
        admin_endpoint: "GET /v1/admin/metrics/fiscal-sli"
      },
      null,
      2
    )
  );

  console.log(`\n[sprint94-verify] OK — FISC-094 SLI fiscal verificado em ${startedAt}`);
}

main().catch((err) => {
  console.error("[sprint94-verify] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
