import { describe, expect, it } from "vitest";
import {
  parseSerproProcuracaoSituacao,
  serproProcuracaoUserMessage
} from "../../src/modules/serpro-integra-contador/domain/serpro-procuracao-situacao";

describe("serpro procuracao situacao", () => {
  it("mock SERPRO retorna valida", () => {
    expect(parseSerproProcuracaoSituacao({ mock: true, situacao: "valida" })).toBe("valida");
  });

  it("mensagem amigavel para suporte", () => {
    expect(serproProcuracaoUserMessage("inexistente")).toContain("e-CAC");
  });
});
