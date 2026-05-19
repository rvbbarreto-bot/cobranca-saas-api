import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("runtime-flags", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("isMockAuthRoutesEnabled: production desliga por padrao", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_MOCK_AUTH", "");
    const { isMockAuthRoutesEnabled } = await import("../../src/platform/config/runtime-flags");
    expect(isMockAuthRoutesEnabled()).toBe(false);
  });

  it("isMockAuthRoutesEnabled: ENABLE_MOCK_AUTH=true forca ligado em production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ENABLE_MOCK_AUTH", "true");
    const { isMockAuthRoutesEnabled } = await import("../../src/platform/config/runtime-flags");
    expect(isMockAuthRoutesEnabled()).toBe(true);
  });

  it("isMockAuthRoutesEnabled: ENABLE_MOCK_AUTH=false forca desligado fora de production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("ENABLE_MOCK_AUTH", "false");
    const { isMockAuthRoutesEnabled } = await import("../../src/platform/config/runtime-flags");
    expect(isMockAuthRoutesEnabled()).toBe(false);
  });
});
