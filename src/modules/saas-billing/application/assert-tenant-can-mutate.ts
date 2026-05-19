import type { PoolClient } from "pg";
import { SaasBillingError } from "../domain/saas-billing-error";
import { refreshSubscriptionReadOnly } from "../infrastructure/subscriptions-repository";
import {
  countMonthlyChargesCreated,
  countPortalClientesForPublicTenant,
  currentYearMonthUtc,
  incrementMonthlyChargesCreated
} from "../infrastructure/usage-repository";

export type AssertMutationKind = "create_charge" | "create_cliente";

export async function assertTenantCanMutate(
  client: PoolClient,
  publicTenantId: string,
  kind: AssertMutationKind
): Promise<void> {
  const sub = await refreshSubscriptionReadOnly(client, publicTenantId);
  if (!sub) {
    return;
  }

  if (sub.read_only) {
    throw new SaasBillingError(
      "SUBSCRIPTION_READ_ONLY",
      "Assinatura em modo somente leitura. Renove o plano para criar novos registros."
    );
  }

  const yearMonth = currentYearMonthUtc();

  if (kind === "create_charge") {
    const used = await countMonthlyChargesCreated(client, publicTenantId, yearMonth);
    if (used >= sub.max_cobrancas_mes) {
      throw new SaasBillingError(
        "LIMIT_COBRANCAS_MES",
        `Limite mensal de cobrancas atingido (${sub.max_cobrancas_mes}).`
      );
    }
    return;
  }

  const clientes = await countPortalClientesForPublicTenant(client, publicTenantId);
  if (clientes >= sub.max_clientes) {
    throw new SaasBillingError(
      "LIMIT_CLIENTES",
      `Limite de clientes do plano atingido (${sub.max_clientes}).`
    );
  }
}

export async function recordChargeCreatedForMetering(
  client: PoolClient,
  publicTenantId: string
): Promise<void> {
  await incrementMonthlyChargesCreated(client, publicTenantId);
}
