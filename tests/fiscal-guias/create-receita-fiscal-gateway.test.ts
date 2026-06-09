import { afterEach, describe, expect, it } from "vitest";
import { createReceitaFiscalGateway } from "../../src/modules/fiscal-guias/infrastructure/receita/create-receita-fiscal-gateway";
import { MockReceitaFiscalGateway } from "../../src/modules/fiscal-guias/infrastructure/receita/mock-receita-fiscal-gateway";
import { SerproReceitaFiscalGateway } from "../../src/modules/fiscal-guias/infrastructure/receita/serpro-receita-fiscal-gateway";
import { HttpReceitaFiscalGateway } from "../../src/modules/fiscal-guias/infrastructure/receita/http-receita-fiscal-gateway";

describe("createReceitaFiscalGateway (EXEQ-FISC-041)", () => {
  const saved: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const key of Object.keys(saved)) {
      const val = saved[key];
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
      delete saved[key];
    }
  });

  function stash(key: string, value: string | undefined): void {
    saved[key] = process.env[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  it("provider mock retorna MockReceitaFiscalGateway", () => {
    const gw = createReceitaFiscalGateway({ provider: "mock" });
    expect(gw).toBeInstanceOf(MockReceitaFiscalGateway);
  });

  it("provider mock captureDas mapeia ReceitaCaptureResult", async () => {
    const gw = createReceitaFiscalGateway({ provider: "mock" })!;
    const result = await gw.captureDas({
      cnpj: "00000000000191",
      competencia: "2026-05",
      certPem: "cert",
      keyPem: "key"
    });
    expect(result.valorPrincipal).toBeGreaterThan(0);
    expect(result.linhaDigitavel).toMatch(/^858/);
    expect(result.complianceStatus).toBe("aprovado");
  });

  it("provider serpro retorna SerproReceitaFiscalGateway (mock client)", () => {
    stash("FISCAL_SERPRO_MOCK", "true");
    const gw = createReceitaFiscalGateway({ provider: "serpro", contratanteCnpj: "00000000000191" });
    expect(gw).toBeInstanceOf(SerproReceitaFiscalGateway);
  });

  it("provider serpro captureDas via GERARDAS12 mock", async () => {
    stash("FISCAL_SERPRO_MOCK", "true");
    const gw = createReceitaFiscalGateway({ provider: "serpro", contratanteCnpj: "00000000000191" })!;
    const result = await gw.captureDas({
      cnpj: "00000000000191",
      competencia: "2026-05",
      certPem: "cert",
      keyPem: "key"
    });
    expect(result.linhaDigitavel).toBeTruthy();
    expect(result.dataVencimento).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("provider exeq retorna null sem RECEITA_DAS_CAPTURE_URL", () => {
    stash("RECEITA_DAS_CAPTURE_URL", undefined);
    const gw = createReceitaFiscalGateway({ provider: "exeq" });
    expect(gw).toBeNull();
  });

  it("provider exeq retorna HttpReceitaFiscalGateway com URL", () => {
    stash("RECEITA_DAS_CAPTURE_URL", "http://127.0.0.1:19443");
    const gw = createReceitaFiscalGateway({ provider: "exeq" });
    expect(gw).toBeInstanceOf(HttpReceitaFiscalGateway);
  });
});
