import type { PoolClient } from "pg";
import {
  getSubscriptionByTenantId,
  refreshSubscriptionReadOnly
} from "../infrastructure/subscriptions-repository";
import {
  countMonthlyChargesCreated,
  countPortalClientesForPublicTenant,
  currentYearMonthUtc
} from "../infrastructure/usage-repository";

export type TenantSubscriptionView = {
  id: string;
  status: string;
  read_only: boolean;
  trial_ends_at: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  plano: {
    id: string;
    slug: string;
    nome: string;
    max_clientes: number;
    max_cobrancas_mes: number;
    preco_mensal: number;
  };
  uso: {
    year_month: string;
    clientes: number;
    cobrancas_criadas_mes: number;
  };
};

function toIso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

export async function getTenantSubscriptionUseCase(
  client: PoolClient,
  publicTenantId: string
): Promise<TenantSubscriptionView | null> {
  const sub = await refreshSubscriptionReadOnly(client, publicTenantId);
  if (!sub) {
    return null;
  }

  const yearMonth = currentYearMonthUtc();
  const [clientes, cobrancasMes] = await Promise.all([
    countPortalClientesForPublicTenant(client, publicTenantId),
    countMonthlyChargesCreated(client, publicTenantId, yearMonth)
  ]);

  return {
    id: sub.id,
    status: sub.status,
    read_only: sub.read_only,
    trial_ends_at: toIso(sub.trial_ends_at),
    current_period_start: toIso(sub.current_period_start),
    current_period_end: toIso(sub.current_period_end),
    plano: {
      id: sub.plano_id,
      slug: sub.plano_slug,
      nome: sub.plano_nome,
      max_clientes: sub.max_clientes,
      max_cobrancas_mes: sub.max_cobrancas_mes,
      preco_mensal: Number(sub.preco_mensal)
    },
    uso: {
      year_month: yearMonth,
      clientes,
      cobrancas_criadas_mes: cobrancasMes
    }
  };
}

export async function getSubscriptionByTenantIdOrThrow(
  client: PoolClient,
  publicTenantId: string
) {
  const sub = await refreshSubscriptionReadOnly(client, publicTenantId);
  if (!sub) {
    return null;
  }
  return sub;
}
