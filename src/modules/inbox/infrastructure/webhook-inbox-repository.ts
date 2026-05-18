import type { PoolClient } from "pg";

export type WebhookInboxRow = {
  id: string;
  tenantId: string;
  source: string;
  externalEventId: string | null;
  createdAt: string;
  processedAt: string | null;
};

function mapRow(row: Record<string, unknown>): WebhookInboxRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    source: String(row.source),
    externalEventId: row.external_event_id ? String(row.external_event_id) : null,
    createdAt:
      row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    processedAt:
      row.processed_at instanceof Date
        ? row.processed_at.toISOString()
        : row.processed_at
          ? String(row.processed_at)
          : null
  };
}

export async function insertWebhookInbox(
  client: PoolClient,
  input: {
    source: string;
    externalEventId: string | null;
    payload: unknown;
    correlationId: string | null;
  }
): Promise<{ inserted: boolean; row: WebhookInboxRow | null; alreadyProcessed: boolean }> {
  if (!input.externalEventId) {
    const ins = await client.query<Record<string, unknown>>(
      `INSERT INTO webhook_inbox (tenant_id, source, external_event_id, payload, correlation_id)
       VALUES (
         current_setting('app.tenant_id', true)::uuid,
         $1,
         NULL,
         $2::jsonb,
         $3
       )
       RETURNING *`,
      [input.source, JSON.stringify(input.payload ?? {}), input.correlationId]
    );
    const row = ins.rows[0];
    return { inserted: true, row: row ? mapRow(row) : null, alreadyProcessed: false };
  }

  const insertResult = await client.query<Record<string, unknown>>(
    `INSERT INTO webhook_inbox (tenant_id, source, external_event_id, payload, correlation_id)
     VALUES (
       current_setting('app.tenant_id', true)::uuid,
       $1,
       $2,
       $3::jsonb,
       $4
     )
     ON CONFLICT (tenant_id, external_event_id) DO NOTHING
     RETURNING *`,
    [input.source, input.externalEventId, JSON.stringify(input.payload ?? {}), input.correlationId]
  );

  if (insertResult.rows[0]) {
    return { inserted: true, row: mapRow(insertResult.rows[0]), alreadyProcessed: false };
  }

  const existing = await client.query<Record<string, unknown>>(
    `SELECT *
     FROM webhook_inbox
     WHERE tenant_id = current_setting('app.tenant_id', true)::uuid
       AND external_event_id = $1`,
    [input.externalEventId]
  );
  const row = existing.rows[0];
  const mapped = row ? mapRow(row) : null;
  return {
    inserted: false,
    row: mapped,
    alreadyProcessed: Boolean(mapped?.processedAt)
  };
}

export type WebhookInboxWorkRow = {
  id: string;
  payload: unknown;
  processedAt: string | null;
};

export async function listPendingWebhookInbox(client: PoolClient, limit: number): Promise<WebhookInboxWorkRow[]> {
  const r = await client.query<{ id: string; payload: unknown; processed_at: Date | null }>(
    `SELECT id, payload, processed_at
     FROM webhook_inbox
     WHERE processed_at IS NULL
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit]
  );
  return r.rows.map((row) => ({
    id: String(row.id),
    payload: row.payload,
    processedAt:
      row.processed_at instanceof Date
        ? row.processed_at.toISOString()
        : row.processed_at
          ? String(row.processed_at)
          : null
  }));
}

export async function isWebhookInboxProcessed(client: PoolClient, id: string): Promise<boolean> {
  const r = await client.query<{ processed_at: Date | null }>(
    `SELECT processed_at FROM webhook_inbox WHERE id = $1::uuid`,
    [id]
  );
  return Boolean(r.rows[0]?.processed_at);
}

export async function markWebhookInboxProcessed(client: PoolClient, id: string): Promise<void> {
  await client.query(
    `UPDATE webhook_inbox
     SET processed_at = now(), last_error = NULL
     WHERE id = $1::uuid`,
    [id]
  );
}

export async function markWebhookInboxDead(client: PoolClient, id: string, error: string): Promise<void> {
  await client.query(
    `UPDATE webhook_inbox
     SET processed_at = now(),
         last_error = $2,
         processing_attempts = processing_attempts + 1
     WHERE id = $1::uuid`,
    [id, error.slice(0, 4000)]
  );
}
