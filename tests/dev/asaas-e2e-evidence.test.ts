import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  SPRINT1_ASSERTION_NAMES,
  applySprint1MetaAssertions,
  buildAutomatedTestsNote,
  evidenceJsonHasForbiddenSecrets,
  maskDbUrl,
  recordAssertion,
  type AsaasE2EEvidence,
  writeAsaasE2EEvidenceReport
} from "../../src/dev/asaas-e2e-evidence-utils";

function minimalEvidence(): AsaasE2EEvidence {
  return {
    executedAt: "2026-05-21T12:00:00.000Z",
    git: { branch: "test", commit: "abc" },
    environment: {
      nodeEnv: "test",
      asaasApiUrl: "https://sandbox.asaas.com/api/v3",
      databaseUrl: maskDbUrl("postgres://user:secret@localhost:5432/db"),
      hasAsaasApiKey: true,
      hasEncryptionKey: true,
      hasWebhookSecret: true
    },
    tenantPublicId: "00000000-0000-4000-8000-000000000001",
    automacaoTenantId: "esc-1",
    correlationId: "e2e-123",
    steps: { createCharge: { idempotency_key: "idem-1" } },
    assertions: [],
    automatedTestsNote: buildAutomatedTestsNote()
  };
}

describe("asaas-e2e-evidence-utils", () => {
  it("maskDbUrl oculta senha na URL", () => {
    expect(maskDbUrl("postgres://app:MyP@ss@db.internal:5432/cobranca")).toBe(
      "postgres://app:***@db.internal:5432/cobranca"
    );
  });

  it("evidenceJsonHasForbiddenSecrets detecta padroes de API key", () => {
    expect(evidenceJsonHasForbiddenSecrets('{"x":"$aact_hml_abc123"}')).toBe(true);
    expect(evidenceJsonHasForbiddenSecrets('{"hasAsaasApiKey":true}')).toBe(false);
  });

  it("writeAsaasE2EEvidenceReport grava JSON valido com assertion evidencia_json_gerada", () => {
    const dir = mkdtempSync(join(tmpdir(), "asaas-e2e-"));
    const evidence = minimalEvidence();
    SPRINT1_ASSERTION_NAMES.slice(0, 10).forEach((name) => {
      recordAssertion(evidence, name, true);
    });

    const path = writeAsaasE2EEvidenceReport(evidence, dir);
    const parsed = JSON.parse(readFileSync(path, "utf8")) as AsaasE2EEvidence;
    expect(parsed.assertions.some((a) => a.name === "evidencia_json_gerada" && a.ok)).toBe(true);
    expect(parsed.environment.databaseUrl).toContain("***");
    rmSync(dir, { recursive: true, force: true });
  });

  it("applySprint1MetaAssertions adiciona relatorio, env e reproducivel", () => {
    const evidence = minimalEvidence();
    applySprint1MetaAssertions(evidence);
    const names = evidence.assertions.map((a) => a.name);
    expect(names).toContain("relatorio_sem_segredos");
    expect(names).toContain("env_nao_commitada");
    expect(names).toContain("reproducivel_documentado");
    expect(evidence.secretsPolicy).toMatch(/\.env/);
  });
});
