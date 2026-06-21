import { describe, expect, it, afterEach } from "vitest";
import { serproPgdasdTransmissaoOptionsFromEnv } from "../../src/platform/config/fiscal-serpro-pgdasd";

describe("serproPgdasdTransmissaoOptionsFromEnv", () => {
  const prevSim = process.env.FISCAL_SERPRO_PGDASD_SIMULAR;
  const prevCmp = process.env.FISCAL_SERPRO_PGDASD_COMPARAR;

  afterEach(() => {
    if (prevSim === undefined) delete process.env.FISCAL_SERPRO_PGDASD_SIMULAR;
    else process.env.FISCAL_SERPRO_PGDASD_SIMULAR = prevSim;
    if (prevCmp === undefined) delete process.env.FISCAL_SERPRO_PGDASD_COMPARAR;
    else process.env.FISCAL_SERPRO_PGDASD_COMPARAR = prevCmp;
  });

  it("defaults: transmite e nao compara", () => {
    delete process.env.FISCAL_SERPRO_PGDASD_SIMULAR;
    delete process.env.FISCAL_SERPRO_PGDASD_COMPARAR;
    expect(serproPgdasdTransmissaoOptionsFromEnv()).toEqual({
      indicadorTransmissao: true,
      indicadorComparacao: false
    });
  });

  it("FISCAL_SERPRO_PGDASD_SIMULAR=true desliga transmissao", () => {
    process.env.FISCAL_SERPRO_PGDASD_SIMULAR = "true";
    expect(serproPgdasdTransmissaoOptionsFromEnv().indicadorTransmissao).toBe(false);
  });

  it("FISCAL_SERPRO_PGDASD_COMPARAR=true liga comparacao", () => {
    process.env.FISCAL_SERPRO_PGDASD_COMPARAR = "true";
    expect(serproPgdasdTransmissaoOptionsFromEnv().indicadorComparacao).toBe(true);
  });
});
