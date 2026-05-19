import type { PoolClient } from "pg";

export function currentYearMonthUtc(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function incrementMonthlyChargesCreated(
  client: PoolClient,
  tenantId: string,
  yearMonth = currentYearMonthUtc()
): Promise<number> {
  const q = await client.query<{ cobrancas_criadas: number }>(
    `INSERT INTO tenant_usage_monthly (tenant_id, year_month, cobrancas_criadas)
     VALUES ($1::uuid, $2, 1)
     ON CONFLICT (tenant_id, year_month)
     DO UPDATE SET cobrancas_criadas = tenant_usage_monthly.cobrancas_criadas + 1
     RETURNING cobrancas_criadas`,
    [tenantId, yearMonth]
  );
  return q.rows[0]?.cobrancas_criadas ?? 1;
}

export async function countMonthlyChargesCreated(
  client: PoolClient,
  tenantId: string,
  yearMonth = currentYearMonthUtc()
): Promise<number> {
  const q = await client.query<{ cobrancas_criadas: number }>(
    `SELECT cobrancas_criadas FROM tenant_usage_monthly
     WHERE tenant_id = $1::uuid AND year_month = $2`,
    [tenantId, yearMonth]
  );
  return q.rows[0]?.cobrancas_criadas ?? 0;
}

export async function countPortalClientesForPublicTenant(
  client: PoolClient,
  publicTenantId: string
): Promise<number> {
  const q = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM portal.cliente c
     INNER JOIN portal.billing_tenant_link b ON b.automacao_tenant_id = c.tenant_id
     WHERE b.public_tenant_id = $1::uuid`,
    [publicTenantId]
  );
  return Number(q.rows[0]?.count ?? 0);
}
