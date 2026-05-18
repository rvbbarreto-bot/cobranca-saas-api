import type { PoolClient } from "pg";

export type ClienteCobrancaListItem = {
  id: string;
  canonical_status: string;
  amount: string;
  due_date: string;
  description: string | null;
  type: string | null;
  payment: {
    type: string | null;
    boleto_url: string | null;
    pix_qrcode_base64: string | null;
    pix_emv: string | null;
    expires_at: string | null;
  } | null;
  nfse: {
    status: string;
    numero_nfse: string | null;
    pdf_url: string | null;
  } | null;
};

function mapPayment(row: Record<string, unknown>) {
  if (!row.payment_type && !row.boleto_url && !row.pix_qrcode_base64) {
    return null;
  }
  return {
    type: row.payment_type ? String(row.payment_type) : null,
    boleto_url: row.boleto_url ? String(row.boleto_url) : null,
    pix_qrcode_base64: row.pix_qrcode_base64 ? String(row.pix_qrcode_base64) : null,
    pix_emv: row.pix_emv ? String(row.pix_emv) : null,
    expires_at: row.expires_at
      ? row.expires_at instanceof Date
        ? row.expires_at.toISOString()
        : String(row.expires_at)
      : null
  };
}

export async function listClienteCobrancas(
  client: PoolClient,
  publicTenantId: string,
  clienteId: string,
  options: { status?: string; page: number; limit: number }
): Promise<ClienteCobrancaListItem[]> {
  const offset = (Math.max(1, options.page) - 1) * options.limit;
  const params: unknown[] = [publicTenantId, clienteId, options.limit, offset];
  let statusFilter = "";
  if (options.status?.trim()) {
    statusFilter = ` AND c.canonical_status = $5`;
    params.push(options.status.trim());
  }

  const r = await client.query(
    `SELECT
       c.id::text AS id,
       c.canonical_status,
       c.amount::text AS amount,
       c.due_date::text AS due_date,
       c.reference AS description,
       c.type,
       pt.type AS payment_type,
       pt.boleto_url,
       pt.pix_qrcode_base64,
       pt.pix_emv,
       pt.expires_at,
       n.status AS nfse_status,
       n.numero_nfse,
       n.pdf_url
     FROM charges c
     LEFT JOIN LATERAL (
       SELECT type, boleto_url, pix_qrcode_base64, pix_emv, expires_at
       FROM payment_transactions
       WHERE charge_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) pt ON true
     LEFT JOIN nfse_emissions n ON n.charge_id = c.id
     WHERE c.tenant_id = $1::uuid
       AND (
         c.customer_id = $2::uuid
         OR (c.metadata->>'portal_cliente_id')::uuid = $2::uuid
       )
       ${statusFilter}
     ORDER BY c.created_at DESC
     LIMIT $3 OFFSET $4`,
    params
  );

  return r.rows.map((row) => {
    const rec = row as Record<string, unknown>;
    const nfseStatus = rec.nfse_status ? String(rec.nfse_status) : null;
    return {
      id: String(rec.id),
      canonical_status: String(rec.canonical_status),
      amount: String(rec.amount),
      due_date: String(rec.due_date),
      description: rec.description ? String(rec.description) : null,
      type: rec.type ? String(rec.type) : null,
      payment: mapPayment(rec),
      nfse: nfseStatus
        ? {
            status: nfseStatus,
            numero_nfse: rec.numero_nfse ? String(rec.numero_nfse) : null,
            pdf_url: rec.pdf_url ? String(rec.pdf_url) : null
          }
        : null
    };
  });
}

export async function clienteOwnsCharge(
  client: PoolClient,
  publicTenantId: string,
  chargeId: string,
  clienteId: string
): Promise<boolean> {
  const r = await client.query(
    `SELECT 1 FROM charges c
     WHERE c.id = $1::uuid AND c.tenant_id = $2::uuid
       AND (
         c.customer_id = $3::uuid
         OR (c.metadata->>'portal_cliente_id')::uuid = $3::uuid
       )
     LIMIT 1`,
    [chargeId, publicTenantId, clienteId]
  );
  return (r.rowCount ?? 0) > 0;
}
