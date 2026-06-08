import { describe, expect, it } from "vitest";
import {
  canTransitionProcessamento,
  type ProcessamentoStatus
} from "../../src/modules/fiscal-processamento/domain/processamento-status";

describe("processamento-status transitions", () => {
  it("VALIDADO pode ir para TRANSMITINDO ou ERRO", () => {
    expect(canTransitionProcessamento("VALIDADO", "TRANSMITINDO")).toBe(true);
    expect(canTransitionProcessamento("VALIDADO", "ERRO")).toBe(true);
    expect(canTransitionProcessamento("VALIDADO", "TRANSMITIDA")).toBe(false);
  });

  it("TRANSMITINDO pode ir para TRANSMITIDA ou ERRO", () => {
    expect(canTransitionProcessamento("TRANSMITINDO", "TRANSMITIDA")).toBe(true);
    expect(canTransitionProcessamento("TRANSMITINDO", "ERRO")).toBe(true);
  });

  it("estados terminais nao transicionam", () => {
    const terminals: ProcessamentoStatus[] = ["CONCLUIDO", "ERRO"];
    for (const from of terminals) {
      expect(canTransitionProcessamento(from, "VALIDADO")).toBe(false);
      expect(canTransitionProcessamento(from, "TRANSMITINDO")).toBe(false);
    }
  });
});
