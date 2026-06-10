/**
 * Fábrica — verificação UX fiscal mobile-first (EXEQ-FISC-070).
 * Uso: npm run verify:sprint70
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const PORTAL_TESTS = [
  "src/pages/ProcessamentosFiscaisPage.test.tsx",
  "src/pages/FiscalDashboardPage.test.tsx"
];

function run(cmd: string, cwd = ROOT): void {
  console.log(`\n[sprint70-verify] $ ${cmd}`);
  execSync(cmd, { cwd, stdio: "inherit", shell: true });
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const portalDir = join(ROOT, "apps/portal-web");

  for (const file of PORTAL_TESTS) {
    run(`npm run test -- --run ${file}`, portalDir);
  }

  const evidenceDir = join(ROOT, "docs/evidencias/sprint-70");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, `sprint70-verify-${startedAt.replace(/[:.]/g, "-")}.json`),
    JSON.stringify(
      {
        sprint: 70,
        issue: "EXEQ-FISC-070",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        portal_tests: PORTAL_TESTS,
        deliverables: [
          "fiscal CSS tokens (--fiscal-*)",
          "AppShell drawer Escape + body scroll lock",
          "rota /fiscal/erros"
        ]
      },
      null,
      2
    )
  );

  console.log(`\n[sprint70-verify] OK — FISC-070 verificado em ${startedAt}`);
}

main().catch((err) => {
  console.error("[sprint70-verify] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
