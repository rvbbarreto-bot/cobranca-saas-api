import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOW = join(process.cwd(), ".github", "workflows", "asaas-e2e-manual.yml");

describe("asaas-e2e-manual GitHub workflow", () => {
  const yml = readFileSync(WORKFLOW, "utf8");

  it("dispara apenas via workflow_dispatch", () => {
    expect(yml).toMatch(/workflow_dispatch/);
    expect(yml).not.toMatch(/^\s*push:/m);
  });

  it("usa secret ASAAS_API_KEY e job skip quando ausente", () => {
    expect(yml).toMatch(/secrets\.ASAAS_API_KEY/);
    expect(yml).toMatch(/asaas-e2e-not-configured/);
  });

  it("executa e2e:asaas:evidence e publica artefacto", () => {
    expect(yml).toMatch(/e2e:asaas:evidence/);
    expect(yml).toMatch(/upload-artifact/);
    expect(yml).toMatch(/docs\/evidencias\/asaas-e2e-\*\.json/);
  });
});
