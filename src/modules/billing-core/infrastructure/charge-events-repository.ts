import type { PoolClient } from "pg";
import type { CanonicalChargeStatus } from "../domain/charge";

export async function insertChargeEvent(
  client: PoolClient,
  input: {
    tenantId: string;
    chargeId: string;
    eventType: string;
    oldStatus: CanonicalChargeStatus | null;
    newStatus: CanonicalChargeStatus | null;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO charge_events
       (tenant_id, charge_id, event_type, old_status, new_status, payload_json)
     VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6::jsonb)`,
    [
      input.tenantId,
      input.chargeId,
      input.eventType,
      input.oldStatus,
      input.newStatus,
      JSON.stringify(input.payload ?? {})
    ]
  );
}

export type ChargeEventRow = {
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  payload_json: Record<string, unknown>;
  created_at: string;
};

export async function listChargeEvents(
  client: PoolClient,
  chargeId: string
): Promise<ChargeEventRow[]> {
  const r = await client.query<{
    event_type: string;
    old_status: string | null;
    new_status: string | null;
    payload_json: Record<string, unknown>;
    created_at: Date;
  }>(
    `SELECT event_type, old_status, new_status, payload_json, created_at
     FROM charge_events
     WHERE charge_id = $1::uuid
       AND tenant_id = current_setting('app.tenant_id', true)::uuid
     ORDER BY created_at ASC`,
    [chargeId]
  );
  return r.rows.map((row) => ({
    event_type: row.event_type,
    old_status: row.old_status,
    new_status: row.new_status,
    payload_json: row.payload_json ?? {},
    created_at:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at)
  }));
}

export async function countChargeEvents(
  client: PoolClient,
  chargeId: string,
  eventType: string
): Promise<number> {
  const r = await client.query<{ n: string }>(
    `SELECT count(*)::text AS n
     FROM charge_events
     WHERE charge_id = $1::uuid
       AND event_type = $2
       AND tenant_id = current_setting('app.tenant_id', true)::uuid`,
    [chargeId, eventType]
  );
  return Number(r.rows[0]?.n ?? 0);
}
