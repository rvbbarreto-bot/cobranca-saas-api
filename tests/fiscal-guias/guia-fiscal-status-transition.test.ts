import { describe, expect, it } from "vitest";
import {
  canDisponibilizarGuia,
  evaluateGuiaFiscalStatusTransition
} from "../../src/modules/fiscal-guias/domain/guia-fiscal-status-transition";

describe("evaluateGuiaFiscalStatusTransition", () => {
  it("permite PROCESSANDO -> DISPONIVEL", () => {
    expect(evaluateGuiaFiscalStatusTransition("PROCESSANDO", "DISPONIVEL")).toBe("allow");
  });

  it("nega retrocesso DISPONIVEL -> PROCESSANDO", () => {
    expect(evaluateGuiaFiscalStatusTransition("DISPONIVEL", "PROCESSANDO")).toBe("deny");
  });

  it("terminal PAGO apenas noop", () => {
    expect(evaluateGuiaFiscalStatusTransition("PAGO", "PAGO")).toBe("noop");
    expect(evaluateGuiaFiscalStatusTransition("PAGO", "CANCELADO")).toBe("deny");
  });
});

describe("canDisponibilizarGuia", () => {
  it("exige compliance aprovado ou dispensado", () => {
    expect(canDisponibilizarGuia("aprovado")).toBe(true);
    expect(canDisponibilizarGuia("dispensado")).toBe(true);
    expect(canDisponibilizarGuia("pendente")).toBe(false);
    expect(canDisponibilizarGuia("bloqueado")).toBe(false);
  });
});
