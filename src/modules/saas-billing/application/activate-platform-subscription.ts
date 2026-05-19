import type { PoolClient } from "pg";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import { SaasBillingError } from "../domain/saas-billing-error";
import { AsaasPlatformBillingAdapter } from "../infrastructure/asaas-platform/asaas-platform-billing.adapter";
import { getPlatformAsaasConfig } from "../infrastructure/asaas-platform/platform-asaas-config";
import {
  getSubscriptionByTenantId,
  updateSubscriptionGatewayActivation
} from "../infrastructure/subscriptions-repository";

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function defaultBillingEmail(slug: string): string {
  const domain = process.env.PLATFORM_BILLING_EMAIL_DOMAIN?.trim() || "billing.saas.local";
  return `${slug}@${domain}`;
}

/** CNPJ genérico para sandbox Asaas (escritório sem documento fiscal na plataforma). */
const PLATFORM_BILLING_CNPJ = "24971563792";

export type ActivatePlatformSubscriptionResult = {
  gatewayCustomerId: string;
  gatewaySubscriptionId: string;
  status: string;
  nextDueDate: string;
};

export async function activatePlatformSubscription(
  client: PoolClient,
  publicTenantId: string
): Promise<ActivatePlatformSubscriptionResult> {
  const config = getPlatformAsaasConfig();
  if (!config) {
    throw new SaasBillingError(
      "PLATFORM_BILLING_NOT_CONFIGURED",
      "Configure ASAAS_PLATFORM_API_KEY ou ASAAS_API_KEY para ativar cobranca recorrente."
    );
  }

  const sub = await getSubscriptionByTenantId(client, publicTenantId);
  if (!sub) {
    throw new SaasBillingError("SUBSCRIPTION_NOT_FOUND", "Assinatura nao encontrada para o tenant.");
  }

  if (sub.gateway_subscription_id) {
    throw new SaasBillingError(
      "SUBSCRIPTION_ALREADY_ACTIVATED",
      "Assinatura ja possui gateway_subscription_id."
    );
  }

  if (sub.status === "canceled") {
    throw new SaasBillingError("SUBSCRIPTION_NOT_ELIGIBLE", "Assinatura cancelada nao pode ser ativada.");
  }

  const tenantQ = await client.query<{ slug: string; name: string; billing_email: string | null }>(
    `SELECT slug, name, billing_email FROM tenants WHERE id = $1::uuid`,
    [publicTenantId]
  );
  const tenant = tenantQ.rows[0];
  if (!tenant) {
    throw new SaasBillingError("SUBSCRIPTION_NOT_FOUND", "Tenant publico nao encontrado.");
  }

  const adapter = new AsaasPlatformBillingAdapter(config);
  const email = tenant.billing_email?.trim() || defaultBillingEmail(tenant.slug);
  const nextDue = sub.trial_ends_at && sub.trial_ends_at > new Date() ? sub.trial_ends_at : new Date();
  const nextDueDate = formatDateYmd(nextDue);
  const value = Number(sub.preco_mensal);

  let gatewayCustomerId = sub.gateway_customer_id;
  if (!gatewayCustomerId) {
    gatewayCustomerId = await adapter.createCustomer({
      name: tenant.name,
      email,
      cpfCnpj: PLATFORM_BILLING_CNPJ,
      externalReference: publicTenantId
    });
  }

  const gatewaySubscriptionId = await adapter.createSubscription({
    customerId: gatewayCustomerId,
    value,
    nextDueDate,
    description: `Plano ${sub.plano_nome}`,
    externalReference: publicTenantId,
    billingType: config.billingType
  });

  const periodEnd = new Date(nextDue);
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const updated = await updateSubscriptionGatewayActivation(client, {
    tenantId: publicTenantId,
    gatewayCustomerId,
    gatewaySubscriptionId,
    status: "active",
    currentPeriodStart: new Date(),
    currentPeriodEnd: periodEnd
  });

  await writeAuditLog(
    {
      tenantId: publicTenantId,
      action: "update",
      resourceType: "saas_subscription",
      resourceId: sub.id,
      newValue: {
        gateway_subscription_id: gatewaySubscriptionId,
        gateway_customer_id: gatewayCustomerId,
        status: updated.status
      }
    },
    client
  );

  return {
    gatewayCustomerId,
    gatewaySubscriptionId,
    status: updated.status,
    nextDueDate
  };
}
