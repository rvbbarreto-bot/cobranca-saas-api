import type { Client, PoolClient } from "pg";

/** Conexão PG com `query` (pool ou `Client` dedicado em scripts/seed). */
export type ChargeDbClient = PoolClient | Client;
import { evaluateChargeStatusTransition } from "../application/charge-status-transition";
import type { Charge, ChargePaymentType, ChargePaymentView, CanonicalChargeStatus } from "../domain/charge";

const NON_EDITABLE_STATUSES: ReadonlySet<CanonicalChargeStatus> = new Set(["paga", "cancelada"]);

function mapRow(row: Record<string, unknown>): Charge {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    reference: String(row.reference),
    idempotencyKey: String(row.idempotency_key),
    amount: String(row.amount),
    dueDate:
      row.due_date instanceof Date
        ? row.due_date.toISOString().slice(0, 10)
        : String(row.due_date).slice(0, 10),
    type: row.type === "pix" ? "pix" : "boleto",
    canonicalStatus: row.canonical_status as Charge["canonicalStatus"],
    provider: row.provider ? String(row.provider) : null,
    providerChargeId: row.provider_charge_id ? String(row.provider_charge_id) : null,
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at)
  };
}

export async function insertCharge(
  client: ChargeDbClient,
  input: {
    reference: string;
    idempotencyKey: string;
    amount: number;
    dueDate: string;
    type?: ChargePaymentType;
    provider?: string;
    providerChargeId?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<{ charge: Charge; inserted: boolean }> {
  const chargeType = input.type === "pix" ? "pix" : "boleto";
  const insertResult = await client.query<Record<string, unknown>>(
    `INSERT INTO charges (
      tenant_id,
      reference,
      idempotency_key,
      amount,
      due_date,
      type,
      canonical_status,
      provider,
      provider_charge_id,
      metadata
    )
    VALUES (
      current_setting('app.tenant_id', true)::uuid,
      $1,
      $2,
      $3,
      $4::date,
      $8,
      'rascunho',
      $5,
      $6,
      $7::jsonb
    )
    ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
    RETURNING *`,
    [
      input.reference,
      input.idempotencyKey,
      input.amount,
      input.dueDate,
      input.provider ?? null,
      input.providerChargeId ?? null,
      JSON.stringify(input.metadata ?? {}),
      chargeType
    ]
  );

  if (insertResult.rows[0]) {
    return { charge: mapRow(insertResult.rows[0]), inserted: true };
  }

  const again = await client.query<Record<string, unknown>>(
    `SELECT * FROM charges WHERE tenant_id = current_setting('app.tenant_id', true)::uuid AND idempotency_key = $1`,
    [input.idempotencyKey]
  );
  const row = again.rows[0];
  if (!row) {
    throw new Error("Falha de idempotencia: registro nao encontrado apos conflito.");
  }
  return { charge: mapRow(row), inserted: false };
}

export type ChargeKeysetCursor = { createdAtIso: string; id: string };

export async function listCharges(client: PoolClient, limit = 50): Promise<Charge[]> {
  const r = await client.query<Record<string, unknown>>(
    `SELECT * FROM charges
     WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
     ORDER BY created_at DESC
     LIMIT $1`,
    [limit]
  );
  return r.rows.map(mapRow);
}

/**
 * Paginação estável: `ORDER BY created_at DESC, id DESC` + cursor `(created_at, id)` menor que o último visto.
 * Devolve até `limit` itens e `has_more` se existir página seguinte (consulta `limit+1`).
 */
export async function listChargesPage(
  client: PoolClient,
  options: { limit: number; cursor?: ChargeKeysetCursor | null }
): Promise<{ items: Charge[]; has_more: boolean }> {
  const lim = Math.min(Math.max(Math.floor(options.limit), 1), 200);
  const fetchN = lim + 1;
  const params: unknown[] = [];
  let p = 1;
  let where = `WHERE tenant_id = current_setting('app.tenant_id', true)::uuid`;
  if (options.cursor) {
    where += ` AND (created_at, id) < ($${p}::timestamptz, $${p + 1}::uuid)`;
    params.push(options.cursor.createdAtIso, options.cursor.id);
    p += 2;
  }
  params.push(fetchN);
  const r = await client.query<Record<string, unknown>>(
    `SELECT * FROM charges
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${p}`,
    params
  );
  const mapped = r.rows.map(mapRow);
  const has_more = mapped.length > lim;
  const items = has_more ? mapped.slice(0, lim) : mapped;
  return { items, has_more };
}

export async function getChargeById(client: PoolClient, chargeId: string): Promise<Charge | null> {
  const r = await client.query<Record<string, unknown>>(
    `SELECT * FROM charges
     WHERE id = $1::uuid
       AND tenant_id = current_setting('app.tenant_id', true)::uuid
     LIMIT 1`,
    [chargeId]
  );
  const row = r.rows[0];
  return row ? mapRow(row) : null;
}

function mapPaymentRow(row: Record<string, unknown>): ChargePaymentView | null {
  const paymentType = row.payment_type;
  if (paymentType !== "boleto" && paymentType !== "pix") {
    return null;
  }
  const expires =
    row.payment_expires_at instanceof Date
      ? row.payment_expires_at.toISOString()
      : row.payment_expires_at
        ? String(row.payment_expires_at)
        : null;

  return {
    type: paymentType as ChargePaymentType,
    boleto_url: row.boleto_url ? String(row.boleto_url) : null,
    boleto_pdf_url: row.boleto_pdf_url ? String(row.boleto_pdf_url) : null,
    boleto_barcode: row.boleto_barcode ? String(row.boleto_barcode) : null,
    pix_qrcode_base64: row.pix_qrcode_base64 ? String(row.pix_qrcode_base64) : null,
    pix_emv: row.pix_emv ? String(row.pix_emv) : null,
    pix_link: row.pix_link ? String(row.pix_link) : null,
    expires_at: expires
  };
}

/**
 * Cobrança + última payment_transaction (para GET /v1/portal/cobrancas/:id).
 * `payment` é null se ainda não houve emissão no gateway.
 */
export async function getChargeWithLatestPayment(
  client: PoolClient,
  chargeId: string,
  tenantId: string
): Promise<{ charge: Charge; payment: ChargePaymentView | null } | null> {
  const r = await client.query<Record<string, unknown>>(
    `SELECT
       c.*,
       pt.type            AS payment_type,
       pt.status          AS payment_status,
       pt.boleto_url,
       pt.boleto_pdf_url,
       pt.boleto_barcode,
       pt.pix_qrcode_base64,
       pt.pix_emv,
       pt.pix_link,
       pt.expires_at      AS payment_expires_at
     FROM charges c
     LEFT JOIN payment_transactions pt ON pt.charge_id = c.id
     WHERE c.id = $1::uuid
       AND c.tenant_id = $2::uuid
     ORDER BY pt.created_at DESC NULLS LAST
     LIMIT 1`,
    [chargeId, tenantId]
  );
  const row = r.rows[0];
  if (!row) {
    return null;
  }
  return {
    charge: mapRow(row),
    payment: mapPaymentRow(row)
  };
}

export type PatchChargeFieldsResult =
  | { ok: true; charge: Charge }
  | { ok: false; reason: "not_found" | "not_editable" };

/**
 * Atualiza valor, vencimento e/ou metadata (merge superficial) quando a cobrança
 * não está paga nem cancelada.
 */
export async function patchChargeEditableFields(
  client: PoolClient,
  chargeId: string,
  patch: {
    amount?: number;
    dueDate?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<PatchChargeFieldsResult> {
  const current = await getChargeById(client, chargeId);
  if (!current) {
    return { ok: false, reason: "not_found" };
  }
  if (NON_EDITABLE_STATUSES.has(current.canonicalStatus)) {
    return { ok: false, reason: "not_editable" };
  }

  const amount = patch.amount !== undefined ? patch.amount : Number(current.amount);
  const dueDate = patch.dueDate !== undefined ? patch.dueDate : current.dueDate;
  const meta =
    patch.metadata !== undefined
      ? { ...current.metadata, ...patch.metadata }
      : current.metadata;

  const upd = await client.query<Record<string, unknown>>(
    `UPDATE charges
     SET amount = $2::numeric,
         due_date = $3::date,
         metadata = $4::jsonb,
         updated_at = now()
     WHERE id = $1::uuid
       AND tenant_id = current_setting('app.tenant_id', true)::uuid
     RETURNING *`,
    [chargeId, amount, dueDate, JSON.stringify(meta)]
  );
  const row = upd.rows[0];
  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, charge: mapRow(row) };
}

export async function listChargesByPortalClienteId(
  client: PoolClient,
  portalClienteId: string,
  limit: number
): Promise<Charge[]> {
  const r = await client.query<Record<string, unknown>>(
    `SELECT * FROM charges
     WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
       AND metadata->>'portal_cliente_id' = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [portalClienteId, limit]
  );
  return r.rows.map(mapRow);
}

export async function listChargesByPortalClienteIdPage(
  client: PoolClient,
  portalClienteId: string,
  options: { limit: number; cursor?: ChargeKeysetCursor | null }
): Promise<{ items: Charge[]; has_more: boolean }> {
  const lim = Math.min(Math.max(Math.floor(options.limit), 1), 200);
  const fetchN = lim + 1;
  const params: unknown[] = [portalClienteId];
  let p = 2;
  let where = `WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
     AND metadata->>'portal_cliente_id' = $1`;
  if (options.cursor) {
    where += ` AND (created_at, id) < ($${p}::timestamptz, $${p + 1}::uuid)`;
    params.push(options.cursor.createdAtIso, options.cursor.id);
    p += 2;
  }
  params.push(fetchN);
  const r = await client.query<Record<string, unknown>>(
    `SELECT * FROM charges
     ${where}
     ORDER BY created_at DESC, id DESC
     LIMIT $${p}`,
    params
  );
  const mapped = r.rows.map(mapRow);
  const has_more = mapped.length > lim;
  const items = has_more ? mapped.slice(0, lim) : mapped;
  return { items, has_more };
}

export type UpdateChargeStatusResult =
  | { ok: true; charge: Charge; applied: boolean }
  | {
      ok: false;
      reason: "not_found" | "illegal_transition";
      from?: Charge["canonicalStatus"];
      to?: Charge["canonicalStatus"];
    };

export async function updateChargeCanonicalStatus(
  client: PoolClient,
  input: {
    canonicalStatus: Charge["canonicalStatus"];
    reference?: string;
    providerChargeId?: string;
  }
): Promise<UpdateChargeStatusResult> {
  const ref = input.reference?.trim() || null;
  const pid = input.providerChargeId?.trim() || null;
  if (!ref && !pid) {
    return { ok: false, reason: "not_found" };
  }

  const sel = await client.query<Record<string, unknown>>(
    `SELECT * FROM charges
     WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
       AND (
         ($1::text IS NOT NULL AND reference = $1)
         OR ($2::text IS NOT NULL AND provider_charge_id = $2)
       )
     LIMIT 1`,
    [ref, pid]
  );
  const currentRow = sel.rows[0];
  if (!currentRow) {
    return { ok: false, reason: "not_found" };
  }

  const current = mapRow(currentRow);
  const decision = evaluateChargeStatusTransition(current.canonicalStatus, input.canonicalStatus);
  if (decision === "deny") {
    return {
      ok: false,
      reason: "illegal_transition",
      from: current.canonicalStatus,
      to: input.canonicalStatus
    };
  }
  if (decision === "noop") {
    return { ok: true, charge: current, applied: false };
  }

  const upd = await client.query<Record<string, unknown>>(
    `UPDATE charges
     SET canonical_status = $1::text,
         paid_at = CASE WHEN $1::text = 'paga' THEN now() ELSE paid_at END,
         cancelled_at = CASE WHEN $1::text = 'cancelada' THEN now() ELSE cancelled_at END,
         updated_at = now()
     WHERE id = $2::uuid
       AND tenant_id = current_setting('app.tenant_id', true)::uuid
     RETURNING *`,
    [input.canonicalStatus, current.id]
  );
  const row = upd.rows[0];
  if (!row) {
    return { ok: false, reason: "not_found" };
  }
  return { ok: true, charge: mapRow(row), applied: true };
}
