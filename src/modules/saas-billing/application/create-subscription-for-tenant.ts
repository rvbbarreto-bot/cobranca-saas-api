import type { PoolClient } from "pg";
import { SaasBillingError } from "../domain/saas-billing-error";
import { findPlanBySlug } from "../infrastructure/plans-repository";
import { insertSubscriptionTrial } from "../infrastructure/subscriptions-repository";

const DEFAULT_PLAN_SLUG = "basico";

export async function createSubscriptionForTenant(
  client: PoolClient,
  input: { tenantId: string; planoSlug?: string; trialDays?: number }
) {
  const slug = (input.planoSlug?.trim().toLowerCase() || DEFAULT_PLAN_SLUG) as string;
  const plan = await findPlanBySlug(client, slug);
  if (!plan) {
    throw new SaasBillingError("PLAN_NOT_FOUND", `Plano '${slug}' nao encontrado.`);
  }

  return insertSubscriptionTrial(client, {
    tenantId: input.tenantId,
    planoId: plan.id,
    trialDays: input.trialDays ?? 14
  });
}
