import { getPool } from "../../../platform/persistence/pool";
import { writeFiscalAuditLog } from "../infrastructure/fiscal-audit.service";
import {
  certificateDaysUntilExpiry,
  certificateExpiryAlertThreshold,
  listActiveVaultCertsForExpiryRefresh,
  nextCertificateVaultStatus,
  updateCertificateVaultStatusById
} from "../infrastructure/certificate-vault-expiry-repository";

export type CertificateExpiryJobResult = {
  scanned: number;
  statusUpdated: number;
  alertsEmitted: number;
};

export async function processCertificateVaultExpiryJob(): Promise<CertificateExpiryJobResult> {
  const pool = getPool();
  const rows = await listActiveVaultCertsForExpiryRefresh(pool);
  const client = await pool.connect();
  let statusUpdated = 0;
  let alertsEmitted = 0;

  try {
    for (const row of rows) {
      const nextStatus = nextCertificateVaultStatus(row.valid_until);
      const daysLeft = certificateDaysUntilExpiry(row.valid_until);
      const threshold = certificateExpiryAlertThreshold(daysLeft);
      const lastAlert =
        typeof row.metadata.last_expiry_alert_days === "number"
          ? row.metadata.last_expiry_alert_days
          : null;

      if (row.status !== nextStatus) {
        await updateCertificateVaultStatusById(client, row.id, nextStatus);
        statusUpdated += 1;
      }

      if (nextStatus === "expired") {
        continue;
      }

      if (threshold && lastAlert !== threshold) {
        const certMeta = await client.query<{ automacao_tenant_id: string; portal_cliente_id: string | null }>(
          `SELECT automacao_tenant_id, portal_cliente_id::text
           FROM fiscal.certificate_vault WHERE id = $1::uuid`,
          [row.id]
        );
        const meta = certMeta.rows[0];
        if (meta) {
          await writeFiscalAuditLog(
            {
              tenantId: meta.automacao_tenant_id,
              action: "certificado_expirando",
              resourceType: "certificate_vault",
              resourceId: row.id,
              newValue: { days_left: daysLeft, threshold, valid_until: row.valid_until }
            },
            client
          );
          await updateCertificateVaultStatusById(client, row.id, nextStatus === "active" ? "expiring" : nextStatus, {
            last_expiry_alert_days: threshold
          });
          alertsEmitted += 1;
        }
      }
    }
  } finally {
    client.release();
  }

  return { scanned: rows.length, statusUpdated, alertsEmitted };
}
