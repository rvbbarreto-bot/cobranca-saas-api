import { readFileSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export const FISCAL_E2E_CNPJ = "00000000000191";
export const FISCAL_CSV_TEMPLATE = join(process.cwd(), "docs/templates/pgdasd-import-v1.csv");

export function pickFiscalE2eCompetencia(): string {
  const now = new Date();
  const offsetMonths = (Date.now() % 18) + 2;
  const d = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Gera CSV temporário com competência única (validação PGDASD). */
export function writeFiscalE2eCsv(competencia = pickFiscalE2eCompetencia()): string {
  const template = readFileSync(FISCAL_CSV_TEMPLATE, "utf8");
  const lines = template.trimEnd().split(/\r?\n/);
  const header = lines[0]!;
  const cols = lines[1]!.split(",");
  cols[1] = competencia;
  const dir = mkdtempSync(join(tmpdir(), "fiscal-portal-e2e-"));
  const filePath = join(dir, `pgdasd-${competencia}.csv`);
  writeFileSync(filePath, `${header}\n${cols.join(",")}\n`, "utf8");
  return filePath;
}

export function isFiscalPortalMockMode(): boolean {
  if (process.env.E2E_FISCAL_LIVE === "1" && process.env.E2E_FISCAL_MOCK !== "1") {
    return false;
  }
  if (process.env.E2E_FISCAL_MOCK === "0") {
    return false;
  }
  return true;
}

export function isFiscalPortalLiveMode(): boolean {
  return process.env.E2E_FISCAL_LIVE === "1";
}
