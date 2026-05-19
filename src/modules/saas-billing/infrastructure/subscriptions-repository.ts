import type { PoolClient } from "pg";
import type { SubscriptionStatus } from "../domain/subscription-status";

export type SubscriptionRow = {
  id: string;
  tenant_id: string;
  plano_id: string;
  status: SubscriptionStatus;
  trial_ends_at: Date | null;
  current_period_start: Date | null;
  current_period_end: Date | null;
  gateway_subscription_id: string | null;
  read_only: boolean;
  plano_slug: string;
  plano_nome: string;
  max_clientes: number;
  max_cobrancas_mes: number;
  preco_mensal: string;
};

export async function insertSubscriptionTrial(
  client: PoolClient,
  input: {
    tenantId: string;
    planoId: string;
    trialDays?: number;
  }
): Promise<SubscriptionRow> {
  const trialDays = input.trialDays ?? 14;
  const q = await client.query<SubscriptionRow>(
    `INSERT INTO assinaturas (
       tenant_id, plano_id, status, trial_ends_at, current_period_start, current_period_end
     )
     VALUES (
       $1::uuid, $2::uuid, 'trial',
       now() + ($3::int * interval '1 day'),
       now(),
       now() + ($3::int * interval '1 day')
     )
     RETURNING
       id::text AS id,
       tenant_id::text AS tenant_id,
       plano_id::text AS plano_id,
       status,
       trial_ends_at,
       current_period_start,
       current_period_end,
       gateway_subscription_id,
       read_only`,
    [input.tenantId, input.planoId, trialDays]
  );
  const row = q.rows[0];
  if (!row) {
    throw new Error("INSERT assinaturas sem retorno.");
  }
  return attachPlan(client, row);
}

async function attachPlan(client: PoolClient, partial: SubscriptionRow): Promise<SubscriptionRow> {
  const plan = await client.query<{
    slug: string;
    nome: string;
    max_clientes: number;
    max_cobrancas_mes: number;
    preco_mensal: string;
  }>(
    `SELECT slug, nome, max_clientes, max_cobrancas_mes, preco_mensal::text AS preco_mensal
     FROM planos WHERE id = $1::uuid`,
    [partial.plano_id]
  );
  const p = plan.rows[0];
  if (!p) {
    throw new Error("Plano da assinatura nao encontrado.");
  }
  return {
    ...partial,
    plano_slug: p.slug,
    plano_nome: p.nome,
    max_clientes: p.max_clientes,
    max_cobrancas_mes: p.max_cobrancas_mes,
    preco_mensal: p.preco_mensal
  };
}

export async function getSubscriptionByTenantId(
  client: PoolClient,
  tenantId: string
): Promise<SubscriptionRow | null> {
  const q = await client.query<SubscriptionRow>(
    `SELECT
       a.id::text AS id,
       a.tenant_id::text AS tenant_id,
       a.plano_id::text AS plano_id,
       a.status,
       a.trial_ends_at,
       a.current_period_start,
       a.current_period_end,
       a.gateway_subscription_id,
       a.read_only,
       p.slug AS plano_slug,
       p.nome AS plano_nome,
       p.max_clientes,
       p.max_cobrancas_mes,
       p.preco_mensal::text AS preco_mensal
     FROM assinaturas a
     INNER JOIN planos p ON p.id = a.plano_id
     WHERE a.tenant_id = $1::uuid
     LIMIT 1`,
    [tenantId]
  );
  return q.rows[0] ?? null;
}

export async function refreshSubscriptionReadOnly(
  client: PoolClient,
  tenantId: string
): Promise<SubscriptionRow | null> {
  await client.query(
    `UPDATE assinaturas a
     SET read_only = CASE
           WHEN a.status = 'canceled' THEN true
           WHEN a.status IN ('past_due', 'suspended') THEN true
           WHEN a.status = 'trial' AND a.trial_ends_at IS NOT NULL AND a.trial_ends_at < now() THEN true
           WHEN a.status = 'active' AND a.current_period_end IS NOT NULL AND a.current_period_end < now() THEN true
           ELSE false
         END,
         status = CASE
           WHEN a.status = 'trial' AND a.trial_ends_at IS NOT NULL AND a.trial_ends_at < now() THEN 'suspended'
           ELSE a.status
         END,
         updated_at = now()
     WHERE a.tenant_id = $1::uuid`,
    [tenantId]
  );
  return getSubscriptionByTenantId(client, tenantId);
}
