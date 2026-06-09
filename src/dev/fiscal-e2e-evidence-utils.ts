import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type FiscalHomologE2EEvidence = {
  executedAt: string;
  git: { branch: string; commit: string };
  environment: {
    nodeEnv: string;
    databaseUrl: string;
    receitaDasCaptureUrl: string;
    fiscalCaptureStub: boolean;
    fiscalPdfStorage: string;
    hasEncryptionKey: boolean;
    hasWebhookSecret: boolean;
  };
  tenantPublicId: string;
  automacaoTenantId: string;
  correlationId: string;
  steps: Record<string, unknown>;
  assertions: { name: string; ok: boolean; detail?: string }[];
  automatedTestsNote: string;
};

export const FISCAL_HOMOLOG_ASSERTION_NAMES = [
  "ambiente_receita_configurado",
  "certificado_cadastrado",
  "procuracao_cadastrada",
  "das_inbox_fiscal_processado",
  "das_guia_disponivel_compliance",
  "das_pdf_persistido",
  "das_audit_guia_disponibilizada",
  "das_whatsapp_guia_disponivel",
  "darf_inbox_fiscal_processado",
  "darf_guia_disponivel_compliance",
  "darf_pdf_persistido",
  "darf_audit_guia_disponibilizada",
  "darf_whatsapp_guia_disponivel",
  "relatorio_sem_segredos",
  "evidencia_json_gerada"
] as const;

const FORBIDDEN_IN_REPORT = [/BEGIN PRIVATE KEY/i, /ENCRYPTION_KEY\s*=/i, /ZAPI_TOKEN\s*=/i];

export function maskDbUrl(url: string): string {
  const schemeEnd = url.indexOf("://");
  if (schemeEnd < 0) return url;
  const credStart = schemeEnd + 3;
  const at = url.lastIndexOf("@");
  const colon = url.indexOf(":", credStart);
  if (colon < 0 || at <= colon) return url;
  return `${url.slice(0, colon + 1)}***${url.slice(at)}`;
}

export function gitField(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function recordFiscalAssertion(
  evidence: FiscalHomologE2EEvidence,
  name: string,
  ok: boolean,
  detail?: string
): void {
  evidence.assertions.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`Assertion falhou: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

export function writeFiscalHomologE2EEvidenceReport(evidence: FiscalHomologE2EEvidence): string {
  const dir = join(process.cwd(), "docs", "evidencias");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const stamp = evidence.executedAt.replace(/[:.]/g, "-");
  const path = join(dir, `fiscal-homolog-e2e-${stamp}.json`);
  const serialized = JSON.stringify(evidence, null, 2);
  for (const pattern of FORBIDDEN_IN_REPORT) {
    if (pattern.test(serialized)) {
      throw new Error("Relatorio contem material sensivel — abortando gravacao.");
    }
  }
  writeFileSync(path, serialized, "utf8");
  recordFiscalAssertion(evidence, "evidencia_json_gerada", true, path);
  recordFiscalAssertion(evidence, "relatorio_sem_segredos", true);
  return path;
}

export function buildFiscalHomologTestsNote(): string {
  return [
    "Reproducao homolog fiscal DAS + DARF:",
    "  Terminal 1: npm run receita:mock:gateway  (POST /das/capture e /darf/capture)",
    "  Terminal 2: npm run migrate && npm run seed:dev",
    "  Terminal 3: npm run dev  (workers BullMQ + Redis — opcional para script E2E)",
    "  Terminal 4: RUN_FISCAL_HOMOLOG_E2E=1 RECEITA_DAS_CAPTURE_URL=http://127.0.0.1:19443 npm run fiscal:homolog:e2e",
    "Docs: docs/FISCAL_HOMOLOG_E2E.md"
  ].join("\n");
}

export type FiscalSerproHomologE2EEvidence = {
  executedAt: string;
  git: { branch: string; commit: string };
  issue: "EXEQ-FISC-090";
  environment: {
    nodeEnv: string;
    databaseUrl: string;
    fiscalSerproMock: boolean;
    fiscalPdfStorage: string;
    hasEncryptionKey: boolean;
  };
  automacaoTenantId: string;
  organizationId: string;
  correlationId: string;
  competencia: string;
  steps: Record<string, unknown>;
  assertions: { name: string; ok: boolean; detail?: string }[];
  automatedTestsNote: string;
};

export const FISCAL_SERPRO_HOMOLOG_ASSERTION_NAMES = [
  "schema_processamento_ready",
  "cliente_pgdasd_cadastrado",
  "csv_ingest_validado",
  "processamento_criado",
  "transmissao_serpro_concluida",
  "recibo_pdf_persistido",
  "recibo_url_acessivel",
  "das_guia_concluido",
  "guia_pdf_acessivel",
  "evidencia_json_gerada",
  "relatorio_sem_segredos"
] as const;

export function buildFiscalSerproHomologTestsNote(): string {
  return [
    "Reproducao homolog SERPRO demo (CSV → transmit → recibo → DAS):",
    "  npm run migrate && npm run seed:dev",
    "  RUN_FISCAL_SERPRO_HOMOLOG_E2E=1 npm run fiscal:serpro:homolog:e2e",
    "  Demo mock (default): FISCAL_SERPRO_MOCK=true",
    "  Demo live SERPRO: FISCAL_SERPRO_MOCK=false + credenciais em fiscal.serpro_config",
    "Docs: docs/SERPRO_HOMOLOG_CHECKLIST.md"
  ].join("\n");
}

export function writeFiscalSerproHomologE2EEvidenceReport(
  evidence: FiscalSerproHomologE2EEvidence
): string {
  const dir = join(process.cwd(), "docs", "evidencias");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const stamp = evidence.executedAt.replace(/[:.]/g, "-");
  const path = join(dir, `fiscal-serpro-homolog-e2e-${stamp}.json`);
  const serialized = JSON.stringify(evidence, null, 2);
  for (const pattern of FORBIDDEN_IN_REPORT) {
    if (pattern.test(serialized)) {
      throw new Error("Relatorio contem material sensivel — abortando gravacao.");
    }
  }
  writeFileSync(path, serialized, "utf8");
  recordFiscalSerproAssertion(evidence, "evidencia_json_gerada", true, path);
  recordFiscalSerproAssertion(evidence, "relatorio_sem_segredos", true);
  return path;
}

export function recordFiscalSerproAssertion(
  evidence: FiscalSerproHomologE2EEvidence,
  name: string,
  ok: boolean,
  detail?: string
): void {
  evidence.assertions.push({ name, ok, detail });
  if (!ok) {
    throw new Error(`Assertion falhou: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
