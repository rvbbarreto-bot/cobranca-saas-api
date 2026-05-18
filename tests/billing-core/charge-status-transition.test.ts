import { describe, expect, it } from "vitest";
import { evaluateChargeStatusTransition } from "../../src/modules/billing-core/application/charge-status-transition";

describe("evaluateChargeStatusTransition", () => {
  it("noop quando status igual", () => {
    expect(evaluateChargeStatusTransition("emitida", "emitida")).toBe("noop");
    expect(evaluateChargeStatusTransition("paga", "paga")).toBe("noop");
  });

  it("emitida pode avancar para paga ou pendente_pagamento", () => {
    expect(evaluateChargeStatusTransition("emitida", "paga")).toBe("allow");
    expect(evaluateChargeStatusTransition("emitida", "pendente_pagamento")).toBe("allow");
  });

  it("rascunho aceita avancos reportados por webhook/gateway", () => {
    expect(evaluateChargeStatusTransition("rascunho", "pendente_pagamento")).toBe("allow");
    expect(evaluateChargeStatusTransition("rascunho", "paga")).toBe("allow");
  });

  it("bloqueia paga para emitida", () => {
    expect(evaluateChargeStatusTransition("paga", "emitida")).toBe("deny");
  });

  it("permite cancelada -> emitida (PAYMENT_RESTORED) e bloqueia outros", () => {
    expect(evaluateChargeStatusTransition("cancelada", "emitida")).toBe("allow");
    expect(evaluateChargeStatusTransition("cancelada", "paga")).toBe("deny");
  });

  it("vencida pode ir para paga", () => {
    expect(evaluateChargeStatusTransition("vencida", "paga")).toBe("allow");
  });

  it("erro_emissao pode voltar para emitida", () => {
    expect(evaluateChargeStatusTransition("erro_emissao", "emitida")).toBe("allow");
  });
});
