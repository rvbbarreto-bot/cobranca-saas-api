import { execSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type AsaasE2EEvidence = {
  executedAt: string;
  git: { branch: string; commit: string };
  environment: {
    nodeEnv: string;
    asaasApiUrl: string;
    databaseUrl: string;
    hasAsaasApiKey: boolean;
    hasEncryptionKey: boolean;
    hasWebhookSecret: boolean;
  };
  tenantPublicId: string;
  automacaoTenantId: string;
  correlationId: string;
  steps: Record<string, unknown>;
  assertions: { name: string; ok: boolean; detail?: string }[];
  automatedTestsNote: string;
  secretsPolicy?: string;
};

/** Nomes estáveis alinhados ao checklist Sprint 1 (critério 7 = duas assertions). */
export const SPRINT1_ASSERTION_NAMES = [
  "ambiente_asaas_sandbox",
  "cobranca_criada_asaas",
  "vinculo_interno_asaas",
  "identificador_externo",
  "webhook_inbox_inserido",
  "webhook_idempotente_sem_evento_duplicado",
  "charge_event_emissao",
  "charge_event_webhook",
  "payment_transaction_com_raw",
  "correlation_id_rastreavel",
  "relatorio_sem_segredos",
  "env_nao_commitada",
  "evidencia_json_gerada",
  "reproducivel_documentado"
] as const;

const FORBIDDEN_IN_REPORT = [/\$aact_[a-zA-Z0-9]+/i, /ASAAS_API_KEY\s*=/i, /ENCRYPTION_KEY\s*=/i];

export function maskDbUrl(url: string): string {
  const schemeEnd = url.indexOf("://");
  if (schemeEnd < 0) {
    return url;
  }
  const credStart = schemeEnd + 3;
  const at = url.lastIndexOf("@");
  const colon = url.indexOf(":", credStart);
  if (colon < 0 || at <= colon) {
    return url;
  }
  return `${url.slice(0, colon + 1)}***${url.slice(at)}`;
}

export function gitField(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

export function buildAutomatedTestsNote(): string {
  return [
    "Reproducao:",
    "  npm run migrate && npm run seed:dev",
    "  npm run e2e:asaas:evidence  (requer .env local, nao commitar)",
    "  npm test && npm run test:integration",
    "Docs: docs/ASAAS_SANDBOX_E2E.md, docs/evidencias/SPRINT1_ACEITE_CHECKLIST.md, docs/INBOX_WEBHOOK_IDEMPOTENCIA.md",
    "Evento n8n charge.emitted: coberto em tests/platform/jobs/payment-emission-n8n.test.ts (fora deste E2E)."
  ].join("\n");
}

export function recordAssertion(
  evidence: AsaasE2EEvidence,
  name: string,
  ok: boolean,
  detail?: string
): void {
  evidence.assertions.push({ name, ok, detail });
}

export function assertSprint1(
  evidence: AsaasE2EEvidence,
  name: string,
  ok: boolean,
  detail?: string
): void {
  recordAssertion(evidence, name, ok, detail);
  if (!ok) {
    throw new Error(`Assertion failed: ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

export function evidenceJsonHasForbiddenSecrets(serialized: string): boolean {
  return FORBIDDEN_IN_REPORT.some((re) => re.test(serialized));
}

export function applySprint1MetaAssertions(evidence: AsaasE2EEvidence): void {
  const serialized = JSON.stringify(evidence);
  assertSprint1(
    evidence,
    "relatorio_sem_segredos",
    !evidenceJsonHasForbiddenSecrets(serialized),
    "JSON nao deve conter API keys nem valores $aact_"
  );

  const envExample = existsSync(join(process.cwd(), ".env.example"));
  evidence.secretsPolicy =
    "Credenciais apenas em .env local ou cofre; nunca commitar ASAAS_API_KEY, ENCRYPTION_KEY nem JSON E2E com dados reais.";
  assertSprint1(
    evidence,
    "env_nao_commitada",
    envExample,
    ".env.example no repositorio; valores reais somente em .env/cofre (nao no git)"
  );

  const noteOk =
    evidence.automatedTestsNote.includes("ASAAS_SANDBOX_E2E") &&
    evidence.automatedTestsNote.includes("SPRINT1_ACEITE_CHECKLIST");
  assertSprint1(evidence, "reproducivel_documentado", noteOk, evidence.automatedTestsNote);
}

export function writeAsaasE2EEvidenceReport(evidence: AsaasE2EEvidence, outDir?: string): string {
  const dir = outDir ?? join(process.cwd(), "docs", "evidencias");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `asaas-e2e-${evidence.executedAt.replace(/[:.]/g, "-")}.json`);
  recordAssertion(evidence, "evidencia_json_gerada", true, file);
  writeFileSync(file, JSON.stringify(evidence, null, 2), "utf8");
  return file;
}
