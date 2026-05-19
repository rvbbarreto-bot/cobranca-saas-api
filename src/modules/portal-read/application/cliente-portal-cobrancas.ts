import type { PoolClient } from "pg";

export type ClienteCobrancaPayment = {
  type: string | null;
  boleto_url: string | null;
  pix_qrcode_base64: string | null;
  pix_emv: string | null;
  expires_at: string | null;
};

export type ClienteCobrancaListItem = {
  id: string;
  canonical_status: string;
  amount: string;
  due_date: string;
  description: string | null;
  type: string | null;
  payment: ClienteCobrancaPayment | null;
};

export type ClienteCobrancaEvent = {
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
};

export type ClienteCobrancaDetail = ClienteCobrancaListItem & {
  events: ClienteCobrancaEvent[];
};

function clienteOwnershipSql(clienteParam: string): string {
  return `(
    c.customer_id = ${clienteParam}::uuid
    OR (NULLIF(c.metadata->>'portal_cliente_id', ''))::uuid = ${clienteParam}::uuid
  )`;
}

function mapPayment(row: Record<string, unknown>): ClienteCobrancaPayment | null {
  if (!row.payment_type && !row.boleto_url && !row.pix_qrcode_base64 && !row.pix_emv) {
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

function mapListRow(row: Record<string, unknown>): ClienteCobrancaListItem {
  return {
    id: String(row.id),
    canonical_status: String(row.canonical_status),
    amount: String(row.amount),
    due_date: String(row.due_date),
    description: row.description ? String(row.description) : null,
    type: row.type ? String(row.type) : null,
    payment: mapPayment(row)
  };
}

const CHARGE_SELECT_SQL = `
  SELECT
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
    pt.expires_at
  FROM charges c
  LEFT JOIN LATERAL (
    SELECT type, boleto_url, pix_qrcode_base64, pix_emv, expires_at
    FROM payment_transactions
    WHERE charge_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
  ) pt ON true`;

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
    `${CHARGE_SELECT_SQL}
     WHERE c.tenant_id = $1::uuid
       AND ${clienteOwnershipSql("$2")}
       ${statusFilter}
     ORDER BY c.created_at DESC
     LIMIT $3 OFFSET $4`,
    params
  );

  return r.rows.map((row) => mapListRow(row as Record<string, unknown>));
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
       AND ${clienteOwnershipSql("$3")}`,
    [chargeId, publicTenantId, clienteId]
  );
  return (r.rowCount ?? 0) > 0;
}

export async function getClienteCobrancaDetail(
  client: PoolClient,
  publicTenantId: string,
  chargeId: string,
  clienteId: string
): Promise<ClienteCobrancaDetail | null> {
  const r = await client.query(
    `${CHARGE_SELECT_SQL}
     WHERE c.id = $1::uuid
       AND c.tenant_id = $2::uuid
       AND ${clienteOwnershipSql("$3")}`,
    [chargeId, publicTenantId, clienteId]
  );
  const row = r.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    return null;
  }

  const eventsR = await client.query<{
    event_type: string;
    old_status: string | null;
    new_status: string | null;
    created_at: Date;
  }>(
    `SELECT event_type, old_status, new_status, created_at
     FROM charge_events
     WHERE charge_id = $1::uuid AND tenant_id = $2::uuid
     ORDER BY created_at ASC`,
    [chargeId, publicTenantId]
  );

  return {
    ...mapListRow(row),
    events: eventsR.rows.map((ev) => ({
      event_type: ev.event_type,
      old_status: ev.old_status,
      new_status: ev.new_status,
      created_at:
        ev.created_at instanceof Date ? ev.created_at.toISOString() : String(ev.created_at)
    }))
  };
}
