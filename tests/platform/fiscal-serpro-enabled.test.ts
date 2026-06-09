import { afterEach, describe, expect, it, vi } from "vitest";

describe("isFiscalSerproEnabled (EXEQ-FISC-095 rollback)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function load() {
    return import("../../src/platform/config/fiscal-serpro-enabled");
  }

  it("false explicito bloqueia transmissoes mesmo com guias ligado", async () => {
    vi.stubEnv("FISCAL_GUIAS_ENABLED", "true");
    vi.stubEnv("FISCAL_SERPRO_ENABLED", "false");
    const { isFiscalSerproEnabled } = await load();
    expect(isFiscalSerproEnabled()).toBe(false);
  });

  it("true explicito habilita SERPRO", async () => {
    vi.stubEnv("FISCAL_SERPRO_ENABLED", "true");
    const { isFiscalSerproEnabled } = await load();
    expect(isFiscalSerproEnabled()).toBe(true);
  });

  it("omitido herda FISCAL_GUIAS_ENABLED=true (dev/CI)", async () => {
    vi.stubEnv("FISCAL_GUIAS_ENABLED", "true");
    vi.stubEnv("FISCAL_SERPRO_ENABLED", "");
    const { isFiscalSerproEnabled } = await load();
    expect(isFiscalSerproEnabled()).toBe(true);
  });

  it("omitido com guias desligado retorna false", async () => {
    vi.stubEnv("FISCAL_GUIAS_ENABLED", "false");
    vi.stubEnv("FISCAL_SERPRO_ENABLED", "");
    const { isFiscalSerproEnabled } = await load();
    expect(isFiscalSerproEnabled()).toBe(false);
  });
});
