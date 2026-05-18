import type { PoolClient } from "pg";

export type NfseEmissionView = {
  status: string;
  numero_nfse: string | null;
  codigo_verificacao: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  emitted_at: Date | string | null;
  error_message: string | null;
};

export async function getNfseByCharge(
  client: PoolClient,
  chargeId: string,
  tenantId: string
): Promise<NfseEmissionView | null> {
  const r = await client.query<NfseEmissionView>(
    `SELECT status, numero_nfse, codigo_verificacao, pdf_url, xml_url, emitted_at, error_message
     FROM nfse_emissions
     WHERE charge_id = $1::uuid AND tenant_id = $2
     LIMIT 1`,
    [chargeId, tenantId]
  );
  return r.rows[0] ?? null;
}

export async function chargeBelongsToTenant(
  client: PoolClient,
  chargeId: string,
  tenantId: string
): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM charges WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
    [chargeId, tenantId]
  );
  return (r.rowCount ?? 0) > 0;
}
