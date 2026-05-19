import { describe, expect, it, vi, beforeEach } from "vitest";
import { SaasBillingError } from "../../src/modules/saas-billing/domain/saas-billing-error";

const { createCustomer, createSubscription } = vi.hoisted(() => ({
  createCustomer: vi.fn().mockResolvedValue("cus_test"),
  createSubscription: vi.fn().mockResolvedValue("sub_test")
}));

vi.mock("../../src/modules/saas-billing/infrastructure/asaas-platform/platform-asaas-config", () => ({
  getPlatformAsaasConfig: () => ({
    apiKey: "key",
    billingType: "BOLETO"
  })
}));

vi.mock("../../src/modules/saas-billing/infrastructure/asaas-platform/asaas-platform-billing.adapter", () => ({
  AsaasPlatformBillingAdapter: vi.fn().mockImplementation(() => ({
    createCustomer,
    createSubscription
  }))
}));

const getSub = vi.fn();
const updateActivation = vi.fn();

vi.mock("../../src/modules/saas-billing/infrastructure/subscriptions-repository", async (importOriginal) => {
  const mod = await importOriginal<
    typeof import("../../src/modules/saas-billing/infrastructure/subscriptions-repository")
  >();
  return {
    ...mod,
    getSubscriptionByTenantId: (...args: unknown[]) => getSub(...args),
    updateSubscriptionGatewayActivation: (...args: unknown[]) => updateActivation(...args)
  };
});

vi.mock("../../src/platform/audit/audit.service", () => ({
  writeAuditLog: vi.fn()
}));

import { activatePlatformSubscription } from "../../src/modules/saas-billing/application/activate-platform-subscription";

describe("activatePlatformSubscription", () => {
  beforeEach(() => {
    createCustomer.mockClear();
    createSubscription.mockClear();
    getSub.mockReset();
    updateActivation.mockReset();
  });

  it("cria customer e subscription no Asaas", async () => {
    getSub.mockResolvedValue({
      id: "a1",
      tenant_id: "t1",
      plano_nome: "Profissional",
      preco_mensal: "299.00",
      status: "trial",
      gateway_subscription_id: null,
      gateway_customer_id: null,
      trial_ends_at: new Date("2026-06-01")
    });
    updateActivation.mockResolvedValue({ status: "active" });

    const client = {
      query: vi.fn().mockResolvedValue({
        rows: [{ slug: "escritorio-x", name: "Escritorio X", billing_email: "cobranca@x.com" }]
      })
    };

    const result = await activatePlatformSubscription(client as never, "t1");

    expect(result.gatewaySubscriptionId).toBe("sub_test");
    expect(createCustomer).toHaveBeenCalled();
    expect(createSubscription).toHaveBeenCalled();
    expect(updateActivation).toHaveBeenCalled();
  });

  it("rejeita se ja ativada", async () => {
    getSub.mockResolvedValue({
      id: "a1",
      gateway_subscription_id: "sub_existing",
      status: "active"
    });

    await expect(activatePlatformSubscription({ query: vi.fn() } as never, "t1")).rejects.toBeInstanceOf(
      SaasBillingError
    );
  });
});
