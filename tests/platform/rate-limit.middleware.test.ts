import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("rate-limit.middleware", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("isRateLimitDisabled com VITEST evita limiter real (CI integration)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VITEST", "true");
    const { isRateLimitDisabled } = await import(
      "../../src/platform/http/middleware/rate-limit.middleware"
    );
    expect(isRateLimitDisabled()).toBe(true);
  });

  it("isRateLimitDisabled em NODE_ENV=test", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("VITEST", "");
    const { isRateLimitDisabled } = await import(
      "../../src/platform/http/middleware/rate-limit.middleware"
    );
    expect(isRateLimitDisabled()).toBe(true);
  });

  it("import com VITEST nao dispara validacao express-rate-limit", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VITEST", "true");
    const stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await import("../../src/platform/http/middleware/rate-limit.middleware");

    const validationNoise = stderrSpy.mock.calls.some((args) =>
      String(args[0] ?? "").includes("ERR_ERL_")
    );
    expect(validationNoise).toBe(false);
    stderrSpy.mockRestore();
  });
});
