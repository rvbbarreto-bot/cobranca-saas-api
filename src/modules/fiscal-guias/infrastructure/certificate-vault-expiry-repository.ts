import type { Pool, PoolClient } from "pg";
import { computeCertificateVaultStatus } from "./certificate-pem-crypto";
import { rethrowFiscalSchemaError } from "./fiscal-schema";

export type ExpiringCertificateRow = {
  id: string;
  automacao_tenant_id: string;
  portal_cliente_id: string | null;
  label: string;
  valid_until: string;
  status: string;
  days_left: number;
};

export async function listActiveVaultCertsForExpiryRefresh(
  db: Pool | PoolClient
): Promise<Array<{ id: string; valid_until: string; status: string; metadata: Record<string, unknown> }>> {
  const r = await db.query<{
    id: string;
    valid_until: string;
    status: string;
    metadata: Record<string, unknown>;
  }>(
    `SELECT id::text, valid_until::text, status, COALESCE(metadata, '{}'::jsonb) AS metadata
     FROM fiscal.certificate_vault
     WHERE status IN ('active', 'expiring')`
  );
  return r.rows;
}

export async function updateCertificateVaultStatusById(
  client: PoolClient,
  id: string,
  status: "active" | "expiring" | "expired" | "revoked",
  metadataPatch?: Record<string, unknown>
): Promise<void> {
  if (metadataPatch) {
    await client.query(
      `UPDATE fiscal.certificate_vault
       SET status = $2, metadata = metadata || $3::jsonb, updated_at = now()
       WHERE id = $1::uuid`,
      [id, status, JSON.stringify(metadataPatch)]
    );
    return;
  }
  await client.query(
    `UPDATE fiscal.certificate_vault SET status = $2, updated_at = now() WHERE id = $1::uuid`,
    [id, status]
  );
}

export async function listExpiringCertificatesForTenant(
  automacaoTenantId: string,
  db: Pool | PoolClient,
  maxDays = 30
): Promise<ExpiringCertificateRow[]> {
  try {
    const r = await db.query<ExpiringCertificateRow>(
      `SELECT
         id::text,
         automacao_tenant_id,
         portal_cliente_id::text,
         label,
         valid_until::text,
         status,
         (valid_until - CURRENT_DATE)::int AS days_left
       FROM fiscal.certificate_vault
       WHERE automacao_tenant_id = $1
         AND status IN ('active', 'expiring')
         AND valid_until >= CURRENT_DATE
         AND valid_until <= CURRENT_DATE + ($2::int * interval '1 day')
       ORDER BY valid_until ASC`,
      [automacaoTenantId, maxDays]
    );
    return r.rows;
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
  }
}

export function certificateDaysUntilExpiry(validUntil: string, asOf: Date = new Date()): number {
  const end = new Date(`${validUntil}T23:59:59`);
  if (Number.isNaN(end.getTime())) return 999;
  return Math.ceil((end.getTime() - asOf.getTime()) / (24 * 60 * 60 * 1000));
}

export function certificateExpiryAlertThreshold(daysLeft: number): 30 | 15 | 7 | null {
  if (daysLeft <= 0) return null;
  if (daysLeft <= 7) return 7;
  if (daysLeft <= 15) return 15;
  if (daysLeft <= 30) return 30;
  return null;
}

export function nextCertificateVaultStatus(validUntil: string): "active" | "expiring" | "expired" {
  return computeCertificateVaultStatus(validUntil);
}
