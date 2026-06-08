import { describe, expect, it } from "vitest";
import { createSerproIntegraClient } from "../../src/modules/serpro-integra-contador/infrastructure/serpro-integra-client";
import { buildSerproPgdasdTransmitRequest } from "../../src/modules/serpro-integra-contador/infrastructure/serpro-request-builder";

describe("MockSerproIntegraContadorClient", () => {
  it("declarar retorna protocolo mock", async () => {
    const client = createSerproIntegraClient("https://demo.example", true);
    const req = buildSerproPgdasdTransmitRequest({
      contratanteCnpj: "00000000000191",
      contribuinteCnpj: "00000000000191",
      competencia: "2026-05",
      declaracaoPayload: { receitaBruta: 10000, valorDas: 500 }
    });
    const res = await client.declarar(req, "token");
    expect(res.ok).toBe(true);
    expect(res.protocolo).toMatch(/^MOCK-DECL-/);
  });
});
