import { describe, expect, it } from "vitest";
import {
  collectFiscalSerproProductionEnvIssues,
  collectFiscalSerproProductionEnvWarnings
} from "../../src/platform/config/fiscal-serpro-prod-env";

const VALID_ENC = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("collectFiscalSerproProductionEnvIssues", () => {
  it("nao exige nada quando fiscal desligado", () => {
    expect(
      collectFiscalSerproProductionEnvIssues({
        nodeEnv: "production",
        fiscalGuiasEnabled: "false",
        fiscalSerproEnabled: "false"
      })
    ).toEqual([]);
  });

  it("bloqueia FISCAL_SERPRO_MOCK=true em producao", () => {
    const issues = collectFiscalSerproProductionEnvIssues({
      nodeEnv: "production",
      fiscalSerproMock: "true"
    });
    expect(issues.some((i) => i.includes("FISCAL_SERPRO_MOCK"))).toBe(true);
  });

  it("exige ENCRYPTION_KEY quando FISCAL_GUIAS_ENABLED=true", () => {
    const issues = collectFiscalSerproProductionEnvIssues({
      nodeEnv: "production",
      fiscalGuiasEnabled: "true"
    });
    expect(issues.some((i) => i.includes("ENCRYPTION_KEY"))).toBe(true);
  });

  it("aceita config fiscal prod minima valida", () => {
    expect(
      collectFiscalSerproProductionEnvIssues({
        nodeEnv: "production",
        fiscalGuiasEnabled: "true",
        fiscalSerproEnabled: "true",
        fiscalSerproMock: "false",
        encryptionKey: VALID_ENC
      })
    ).toEqual([]);
  });
});

describe("collectFiscalSerproProductionEnvWarnings", () => {
  it("avisa quando guias ligado sem SERPRO", () => {
    const warnings = collectFiscalSerproProductionEnvWarnings({
      fiscalGuiasEnabled: "true",
      fiscalSerproEnabled: "false"
    });
    expect(warnings.some((w) => w.includes("FISCAL_SERPRO_ENABLED"))).toBe(true);
  });

  it("avisa configuracao portal quando SERPRO live em producao", () => {
    const warnings = collectFiscalSerproProductionEnvWarnings({
      nodeEnv: "production",
      fiscalSerproEnabled: "true",
      fiscalSerproMock: "false"
    });
    expect(warnings.some((w) => w.includes("fiscal.serpro_config"))).toBe(true);
  });
});
