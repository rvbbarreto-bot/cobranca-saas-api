import { describe, expect, it } from "vitest";
import { evaluateChargeStatusTransition } from "../../src/modules/billing-core/application/charge-status-transition";

describe("PAYMENT_RESTORED", () => {
  it("permite cancelada -> emitida", () => {
    expect(evaluateChargeStatusTransition("cancelada", "emitida")).toBe("allow");
  });

  it("nega emitida -> emitida como mudanca (noop)", () => {
    expect(evaluateChargeStatusTransition("emitida", "emitida")).toBe("noop");
  });
});
