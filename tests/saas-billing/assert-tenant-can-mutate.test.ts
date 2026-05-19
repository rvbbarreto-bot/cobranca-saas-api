import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { assertTenantCanMutate } from "../../src/modules/saas-billing/application/assert-tenant-can-mutate";
import { SaasBillingError } from "../../src/modules/saas-billing/domain/saas-billing-error";

vi.mock("../../src/modules/saas-billing/infrastructure/subscriptions-repository", () => ({
  refreshSubscriptionReadOnly: vi.fn()
}));

vi.mock("../../src/modules/saas-billing/infrastructure/usage-repository", () => ({
  countMonthlyChargesCreated: vi.fn(),
  countPortalClientesForPublicTenant: vi.fn(),
  currentYearMonthUtc: () => "2026-05"
}));

import { refreshSubscriptionReadOnly } from "../../src/modules/saas-billing/infrastructure/subscriptions-repository";
import {
  countMonthlyChargesCreated,
  countPortalClientesForPublicTenant
} from "../../src/modules/saas-billing/infrastructure/usage-repository";

const client = {} as PoolClient;
const tenantId = "00000000-0000-4000-8000-000000000001";

describe("assertTenantCanMutate", () => {
  it("permite mutacao quando nao ha assinatura", async () => {
    vi.mocked(refreshSubscriptionReadOnly).mockResolvedValue(null);
    await expect(assertTenantCanMutate(client, tenantId, "create_charge")).resolves.toBeUndefined();
  });

  it("bloqueia create_charge em read_only", async () => {
    vi.mocked(refreshSubscriptionReadOnly).mockResolvedValue({
      id: "s1",
      tenant_id: tenantId,
      plano_id: "p1",
      status: "suspended",
      trial_ends_at: null,
      current_period_start: null,
      current_period_end: null,
      gateway_subscription_id: null,
      read_only: true,
      plano_slug: "basico",
      plano_nome: "Basico",
      max_clientes: 50,
      max_cobrancas_mes: 200,
      preco_mensal: "99.00"
    });
    await expect(assertTenantCanMutate(client, tenantId, "create_charge")).rejects.toMatchObject({
      code: "SUBSCRIPTION_READ_ONLY"
    } satisfies Partial<SaasBillingError>);
  });

  it("bloqueia create_charge ao atingir limite mensal", async () => {
    vi.mocked(refreshSubscriptionReadOnly).mockResolvedValue({
      id: "s1",
      tenant_id: tenantId,
      plano_id: "p1",
      status: "active",
      trial_ends_at: null,
      current_period_start: null,
      current_period_end: null,
      gateway_subscription_id: null,
      read_only: false,
      plano_slug: "basico",
      plano_nome: "Basico",
      max_clientes: 50,
      max_cobrancas_mes: 200,
      preco_mensal: "99.00"
    });
    vi.mocked(countMonthlyChargesCreated).mockResolvedValue(200);
    await expect(assertTenantCanMutate(client, tenantId, "create_charge")).rejects.toMatchObject({
      code: "LIMIT_COBRANCAS_MES"
    });
  });

  it("bloqueia create_cliente ao atingir limite de clientes", async () => {
    vi.mocked(refreshSubscriptionReadOnly).mockResolvedValue({
      id: "s1",
      tenant_id: tenantId,
      plano_id: "p1",
      status: "active",
      trial_ends_at: null,
      current_period_start: null,
      current_period_end: null,
      gateway_subscription_id: null,
      read_only: false,
      plano_slug: "basico",
      plano_nome: "Basico",
      max_clientes: 50,
      max_cobrancas_mes: 200,
      preco_mensal: "99.00"
    });
    vi.mocked(countPortalClientesForPublicTenant).mockResolvedValue(50);
    await expect(assertTenantCanMutate(client, tenantId, "create_cliente")).rejects.toMatchObject({
      code: "LIMIT_CLIENTES"
    });
  });
});
