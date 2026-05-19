import { afterAll, describe, expect, it } from "vitest";
import { closePool } from "../src/platform/persistence/pool";
import { runAsaasSandboxE2E } from "../src/dev/asaas-sandbox-e2e-runner";

const runE2e =
  process.env.RUN_ASAAS_E2E === "1" &&
  Boolean(process.env.DATABASE_URL?.trim()) &&
  Boolean(process.env.ASAAS_API_KEY?.trim()) &&
  Boolean(process.env.ENCRYPTION_KEY?.trim());

describe.skipIf(!runE2e)("Asaas Sandbox E2E (RUN_ASAAS_E2E=1)", () => {
  afterAll(async () => {
    await closePool();
  });

  it("executa fluxo completo e passa todas as assertions", async () => {
    const evidence = await runAsaasSandboxE2E(process.env.DATABASE_URL!.trim());
    const failed = evidence.assertions.filter((a) => !a.ok);
    expect(failed, JSON.stringify(failed, null, 2)).toEqual([]);
  }, 120_000);
});
