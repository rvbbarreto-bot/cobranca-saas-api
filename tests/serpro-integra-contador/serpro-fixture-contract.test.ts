import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  extractSerproDasPayload,
  extractSerproPdfBytes
} from "../../src/modules/serpro-integra-contador/domain/serpro-mock-payload";
import {
  mapSerproHttpError,
  mapSerproIntegraResponse
} from "../../src/modules/serpro-integra-contador/domain/serpro-error-mapper";
import { parseSerproProcuracaoSituacao } from "../../src/modules/serpro-integra-contador/domain/serpro-procuracao-situacao";

const FIXTURES = join(__dirname, "../fixtures/serpro");

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

describe("SERPRO fixture contract (tests/fixtures/serpro)", () => {
  it("declarar-success mapeia protocolo ok", () => {
    const body = loadFixture("declarar-success.json");
    const res = mapSerproIntegraResponse(200, body);
    expect(res.ok).toBe(true);
    expect(res.protocolo).toBe("FIXTURE-DECL-202605-00000000000191");
  });

  it("emitir-das-success extrai linha digitavel e PDF", () => {
    const body = loadFixture("emitir-das-success.json");
    const res = mapSerproIntegraResponse(200, body);
    expect(res.ok).toBe(true);
    const das = extractSerproDasPayload(body);
    expect(das.linhaDigitavel).toMatch(/^858/);
    expect(das.valorPrincipal).toBe(150);
    expect(extractSerproPdfBytes(body)?.length).toBeGreaterThan(0);
  });

  it("consultar-recibo-success extrai PDF", () => {
    const body = loadFixture("consultar-recibo-success.json");
    const res = mapSerproIntegraResponse(200, body);
    expect(res.ok).toBe(true);
    expect(res.protocolo).toMatch(/^FIXTURE-REC-/);
    expect(extractSerproPdfBytes(body)?.toString("utf8")).toContain("mock recibo");
  });

  it("http-error-401 mapeia SERPRO_REJEITOU", () => {
    const body = loadFixture("http-error-401.json");
    const err = mapSerproHttpError(401, body);
    expect(err.code).toBe("SERPRO_REJEITOU");
    expect(err.message).toContain("Unauthorized");
  });

  it("obter-procuracao situacao valida (inline fixture)", () => {
    expect(parseSerproProcuracaoSituacao({ mock: true, situacao: "valida" })).toBe("valida");
  });
});
