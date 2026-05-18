import { describe, expect, it } from "vitest";
import { parseAsaasWebhookChargePayload } from "../../src/modules/inbox/application/parse-asaas-webhook-charge-payload";
import { parseWebhookChargeInstruction } from "../../src/modules/inbox/application/parse-webhook-charge-instruction";

describe("parseAsaasWebhookChargePayload", () => {
  it("mapeia PAYMENT_RECEIVED por payment.id", () => {
    const r = parseAsaasWebhookChargePayload({
      event: "PAYMENT_RECEIVED",
      payment: { id: "pay_abc", status: "RECEIVED", externalReference: "idem-1" }
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.canonicalStatus).toBe("paga");
      expect(r.value.providerChargeId).toBe("pay_abc");
    }
  });

  it("parseWebhookChargeInstruction prioriza formato Asaas", () => {
    const r = parseWebhookChargeInstruction({
      event: "PAYMENT_OVERDUE",
      payment: { id: "pay_x", status: "OVERDUE" }
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.format).toBe("asaas");
      expect(r.value.canonicalStatus).toBe("vencida");
    }
  });
});
