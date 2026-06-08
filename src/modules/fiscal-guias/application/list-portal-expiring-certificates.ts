import { getPool } from "../../../platform/persistence/pool";
import { listExpiringCertificatesForTenant } from "../infrastructure/certificate-vault-expiry-repository";

export async function listPortalExpiringCertificatesUseCase(automacaoTenantId: string) {
  const rows = await listExpiringCertificatesForTenant(automacaoTenantId, getPool());
  return rows.map((row) => ({
    id: row.id,
    portal_cliente_id: row.portal_cliente_id,
    label: row.label,
    valid_until: row.valid_until,
    status: row.status,
    days_left: row.days_left
  }));
}
