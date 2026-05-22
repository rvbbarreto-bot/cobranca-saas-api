import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { config as loadEnv } from "dotenv";
import { bddTitle } from "../reporters/evidence-reporter";
import { ASAAS_RESULT_JSON, EVIDENCE_DIR } from "../helpers/constants";
import { test, expect } from "../fixtures/test";

const root = process.cwd();
loadEnv({ path: join(root, ".env") });

function writeAsaasPartial(partial: Record<string, unknown>): void {
  const dir = join(root, EVIDENCE_DIR);
  mkdirSync(dir, { recursive: true });
  const path = join(root, ASAAS_RESULT_JSON);
  let existing: Record<string, unknown> = {};
  if (existsSync(path)) {
    try {
      existing = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
    } catch {
      existing = {};
    }
  }
  writeFileSync(path, JSON.stringify({ ...existing, ...partial }, null, 2), "utf8");
}

test.describe("Homolog Asaas — workflow GitHub (Sprint J)", () => {
  test(bddTitle("Homolog Asaas — workflow GitHub (Sprint J)", "Workflow sem secret apenas avisa"), async () => {
    const yml = readFileSync(join(root, ".github/workflows/asaas-e2e-manual.yml"), "utf8");
    expect(yml).toContain("asaas-e2e-not-configured");
    expect(yml).toMatch(/secrets\.ASAAS_API_KEY\s*==\s*''/);
    writeAsaasPartial({
      githubWorkflow: {
        validatedAt: new Date().toISOString(),
        note: "Disparo real no GitHub exige secret ASAAS_API_KEY; job asaas-e2e-not-configured validado estaticamente no YAML.",
        jobs: ["asaas-e2e-not-configured", "asaas-e2e"]
      }
    });
  });

  test(bddTitle("Homolog Asaas — workflow GitHub (Sprint J)", "Workflow com secret gera evidência"), async () => {
    test.skip(!process.env.ASAAS_API_KEY?.trim(), "ASAAS_API_KEY não definida — executar no GitHub Actions com secret");
  });

  test(bddTitle("Homolog Asaas — workflow GitHub (Sprint J)", "JSON de evidência não contém segredos"), async () => {
    const example = join(root, EVIDENCE_DIR, "asaas-e2e-EXAMPLE.redacted.json");
    test.skip(!existsSync(example), "Template de exemplo ausente");
    const raw = readFileSync(example, "utf8");
    expect(raw).not.toMatch(/\$aact_/);
    const parsed = JSON.parse(raw) as { environment?: { databaseUrl?: string } };
    if (parsed.environment?.databaseUrl) {
      expect(parsed.environment.databaseUrl).toMatch(/\*+/);
    }
    writeAsaasPartial({ secretsScan: { template: "asaas-e2e-EXAMPLE.redacted.json", ok: true } });
  });
});

test.describe("Homolog Asaas — execução local", () => {
  test(bddTitle("Homolog Asaas — execução local", "Script falha sem DATABASE_URL"), async () => {
    const r = spawnSync("npm run e2e:asaas:evidence", {
      cwd: root,
      env: { ...process.env, DATABASE_URL: "" },
      encoding: "utf8",
      shell: true,
      timeout: 90_000
    });
    expect(r.status).toBe(1);
    expect(`${r.stderr}\n${r.stdout}`).toMatch(/DATABASE_URL ausente/i);
    writeAsaasPartial({
      asaasScript: { case: "missing_database_url", exitCode: r.status, ok: true }
    });
  });

  test(bddTitle("Homolog Asaas — execução local", "Script completo com ambiente válido"), async () => {
    const key = process.env.ASAAS_API_KEY?.trim();
    const db = process.env.DATABASE_URL?.trim();
    test.skip(
      process.env.RUN_ASAAS_E2E !== "1" || !key || !db,
      "Defina RUN_ASAAS_E2E=1 + DATABASE_URL + ASAAS_API_KEY para E2E Asaas real (lento)"
    );

    const r = spawnSync("npm run e2e:asaas:evidence", {
      cwd: root,
      env: process.env,
      encoding: "utf8",
      shell: true,
      timeout: 300_000
    });
    expect(r.status).toBe(0);
    expect(`${r.stdout}`).toMatch(/Assertions:\s*\d+\/\d+\s*OK/i);

    writeAsaasPartial({
      asaasScript: {
        case: "full_run",
        exitCode: 0,
        stdoutTail: r.stdout?.slice(-2000),
        assertionsNote: r.stdout?.match(/Assertions:.+/)?.[0]
      }
    });
  });
});
