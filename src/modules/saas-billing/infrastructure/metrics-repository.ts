import type { Pool } from "pg";
import type { SubscriptionStatus } from "../domain/subscription-status";

export type PlatformMetricsRow = {
  mrr: string;
  tenants_by_status: Record<SubscriptionStatus, number>;
  inadimplencia_past_due: number;
  inadimplencia_suspended: number;
};

export async function fetchPlatformMetrics(pool: Pool): Promise<PlatformMetricsRow> {
  const [mrrRes, statusRes] = await Promise.all([
    pool.query<{ mrr: string }>(
      `SELECT COALESCE(SUM(p.preco_mensal), 0)::text AS mrr
       FROM assinaturas a
       INNER JOIN planos p ON p.id = a.plano_id
       WHERE a.status = 'active'`
    ),
    pool.query<{ status: SubscriptionStatus; count: string }>(
      `SELECT status, COUNT(*)::text AS count
       FROM assinaturas
       GROUP BY status`
    )
  ]);

  const tenants_by_status: Record<SubscriptionStatus, number> = {
    trial: 0,
    active: 0,
    past_due: 0,
    suspended: 0,
    canceled: 0
  };

  for (const row of statusRes.rows) {
    tenants_by_status[row.status] = Number(row.count);
  }

  return {
    mrr: mrrRes.rows[0]?.mrr ?? "0",
    tenants_by_status,
    inadimplencia_past_due: tenants_by_status.past_due,
    inadimplencia_suspended: tenants_by_status.suspended
  };
}
