import type { Pool } from "pg";
import { fetchPlatformMetrics } from "../infrastructure/metrics-repository";

export type PlatformMetricsView = {
  mrr: number;
  currency: "BRL";
  tenants_by_status: Record<string, number>;
  inadimplencia: {
    past_due: number;
    suspended: number;
    total: number;
  };
  generated_at: string;
};

export async function getPlatformMetricsUseCase(pool: Pool): Promise<PlatformMetricsView> {
  const row = await fetchPlatformMetrics(pool);
  const pastDue = row.inadimplencia_past_due;
  const suspended = row.inadimplencia_suspended;

  return {
    mrr: Number(row.mrr),
    currency: "BRL",
    tenants_by_status: row.tenants_by_status,
    inadimplencia: {
      past_due: pastDue,
      suspended,
      total: pastDue + suspended
    },
    generated_at: new Date().toISOString()
  };
}
