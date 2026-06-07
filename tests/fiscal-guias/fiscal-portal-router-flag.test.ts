import { afterEach, describe, expect, it } from "vitest";
import { isFiscalGuiasEnabled } from "../../src/platform/config/fiscal-guias-enabled";
import { registerFiscalCaptureWorker } from "../../src/platform/jobs/workers/fiscal-capture.worker";

describe("Fiscal feature flag (FISCAL_GUIAS_ENABLED)", () => {
  const previous = process.env.FISCAL_GUIAS_ENABLED;

  afterEach(() => {
    if (previous === undefined) {
      delete process.env.FISCAL_GUIAS_ENABLED;
    } else {
      process.env.FISCAL_GUIAS_ENABLED = previous;
    }
  });

  it("default ausente/false mantem modulo desligado", () => {
    delete process.env.FISCAL_GUIAS_ENABLED;
    expect(isFiscalGuiasEnabled()).toBe(false);

    process.env.FISCAL_GUIAS_ENABLED = "false";
    expect(isFiscalGuiasEnabled()).toBe(false);
  });

  it("true ou 1 liga o modulo", () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    expect(isFiscalGuiasEnabled()).toBe(true);

    process.env.FISCAL_GUIAS_ENABLED = "1";
    expect(isFiscalGuiasEnabled()).toBe(true);
  });

  it("worker fiscal nao registra consumer quando flag off", () => {
    process.env.FISCAL_GUIAS_ENABLED = "false";
    expect(registerFiscalCaptureWorker()).toBeNull();
  });
});
