import { describe, expect, it } from "vitest";
import {
  isLikelyPlatformSubscriptionWebhook,
  parseAsaasPlatformSubscriptionWebhook
} from "../../src/modules/saas-billing/application/parse-asaas-platform-subscription-webhook";

describe("parseAsaasPlatformSubscriptionWebhook", () => {
  it("mapeia SUBSCRIPTION_DELETED para canceled", () => {
    const r = parseAsaasPlatformSubscriptionWebhook({
      event: "SUBSCRIPTION_DELETED",
      subscription: { id: "sub_abc", externalReference: "00000000-0000-4000-8000-000000000099" }
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.newStatus).toBe("canceled");
      expect(r.value.gatewaySubscriptionId).toBe("sub_abc");
    }
  });

  it("mapeia PAYMENT_OVERDUE com payment.subscription", () => {
    const r = parseAsaasPlatformSubscriptionWebhook({
      event: "PAYMENT_OVERDUE",
      payment: {
        id: "pay_1",
        subscription: "sub_xyz",
        externalReference: "00000000-0000-4000-8000-000000000001"
      }
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.newStatus).toBe("past_due");
    }
  });

  it("detecta webhook de assinatura plataforma", () => {
    expect(
      isLikelyPlatformSubscriptionWebhook({
        event: "SUBSCRIPTION_UPDATED",
        subscription: { id: "sub_1" }
      })
    ).toBe(true);
    expect(
      isLikelyPlatformSubscriptionWebhook({
        event: "PAYMENT_RECEIVED",
        payment: { id: "p1", subscription: "sub_1" }
      })
    ).toBe(true);
  });
});
