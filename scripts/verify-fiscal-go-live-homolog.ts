/**
 * Gate homolog go-live fiscal — migrate + sprint10 + evidência JSON.
 * Uso: npm run verify:fiscal-go-live-homolog
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();

function run(cmd: string): void {
  console.log(`\n[go-live-homolog] $ ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit", shell: true });
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error("DATABASE_URL ausente.");
  }

  run("npm run migrate");
  run("npm run verify:sprint10");
  run("npm run verify:sprint70");
  run("npm run verify:sprint94");
  run("npm run verify:sprint90");

  const evidenceDir = join(ROOT, "docs/evidencias/fiscal-go-live-homolog");
  mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = join(evidenceDir, `fiscal-go-live-homolog-${startedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        issue: "EXEQ-FISC-095",
        gate: "homolog-pre-go-live",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        steps: [
          "npm run migrate",
          "npm run verify:sprint10",
          "npm run verify:sprint70",
          "npm run verify:sprint94",
          "npm run verify:sprint90"
        ],
        checklist: "docs/FISCAL_GO_LIVE_CHECKLIST.md",
        note: "Assinaturas PO/Tech Lead/DevOps permanecem manuais na secao 6."
      },
      null,
      2
    )
  );

  console.log(`\n[go-live-homolog] OK — evidencia ${evidencePath}`);
}

main().catch((err) => {
  console.error("[go-live-homolog] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
