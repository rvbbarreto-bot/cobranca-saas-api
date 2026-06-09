import type { Pool, PoolClient } from "pg";
import type { ProcessamentoStatus } from "../domain/processamento-status";
import { rethrowFiscalSchemaError } from "../../fiscal-guias/infrastructure/fiscal-schema";

export type ProcessamentoEventoRow = {
  id: string;
  evento: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ProcessamentoFiscalRow = {
  id: string;
  organizationId: string;
  automacaoTenantId: string;
  portalClienteId: string;
  fiscalIngestId: string | null;
  competencia: string;
  tipo: string;
  status: ProcessamentoStatus;
  valorApurado: string | null;
  protocoloSerpro: string | null;
  reciboStorageKey: string | null;
  guiaFiscalId: string | null;
  erroCodigo: string | null;
  correlationId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProcessamentoFiscalInsertResult = ProcessamentoFiscalRow & { inserted: boolean };

const PROC_SELECT_COLS = `
  id::text, organization_id::text, automacao_tenant_id, portal_cliente_id::text,
  fiscal_ingest_id::text, competencia, tipo, status, valor_apurado::text,
  protocolo_serpro, recibo_storage_key, guia_fiscal_id::text, erro_codigo, correlation_id, created_at, updated_at`;

function mapProc(row: {
  id: string;
  organization_id: string;
  automacao_tenant_id: string;
  portal_cliente_id: string;
  fiscal_ingest_id: string | null;
  competencia: string;
  tipo: string;
  status: string;
  valor_apurado: string | null;
  protocolo_serpro: string | null;
  recibo_storage_key: string | null;
  guia_fiscal_id: string | null;
  erro_codigo: string | null;
  correlation_id: string | null;
  created_at: Date;
  updated_at: Date;
}): ProcessamentoFiscalRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    automacaoTenantId: row.automacao_tenant_id,
    portalClienteId: row.portal_cliente_id,
    fiscalIngestId: row.fiscal_ingest_id,
    competencia: row.competencia,
    tipo: row.tipo,
    status: row.status as ProcessamentoStatus,
    valorApurado: row.valor_apurado,
    protocoloSerpro: row.protocolo_serpro,
    reciboStorageKey: row.recibo_storage_key,
    guiaFiscalId: row.guia_fiscal_id,
    erroCodigo: row.erro_codigo,
    correlationId: row.correlation_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function insertProcessamentoEvento(
  client: PoolClient,
  processamentoId: string,
  evento: string,
  payload: Record<string, unknown> = {}
): Promise<void> {
  await client.query(
    `INSERT INTO fiscal.processamento_evento (processamento_id, evento, payload)
     VALUES ($1::uuid, $2, $3::jsonb)`,
    [processamentoId, evento, JSON.stringify(payload)]
  );
}

export async function getProcessamentoByIdempotencyKey(
  client: PoolClient,
  idempotencyKey: string
): Promise<ProcessamentoFiscalRow | null> {
  const r = await client.query(
    `SELECT ${PROC_SELECT_COLS}
     FROM fiscal.processamento_fiscal
     WHERE idempotency_key = $1
     LIMIT 1`,
    [idempotencyKey]
  );
  const row = r.rows[0];
  return row ? mapProc(row) : null;
}

export async function insertProcessamentoFiscal(
  client: PoolClient,
  input: {
    organizationId: string;
    automacaoTenantId: string;
    portalClienteId: string;
    fiscalIngestId: string;
    competencia: string;
    valorApurado: number;
    idempotencyKey: string;
    canonicalSnapshot: Record<string, unknown>;
    correlationId?: string;
  }
): Promise<ProcessamentoFiscalInsertResult> {
  const r = await client.query(
    `INSERT INTO fiscal.processamento_fiscal (
       organization_id, automacao_tenant_id, portal_cliente_id, fiscal_ingest_id,
       competencia, valor_apurado, idempotency_key, correlation_id, canonical_snapshot, status
     ) VALUES ($1::uuid, $2, $3::uuid, $4::uuid, $5, $6, $7, $8, $9::jsonb, 'VALIDADO')
     ON CONFLICT (idempotency_key) DO UPDATE SET updated_at = fiscal.processamento_fiscal.updated_at
     RETURNING
       ${PROC_SELECT_COLS},
       (xmax = 0) AS inserted`,
    [
      input.organizationId,
      input.automacaoTenantId,
      input.portalClienteId,
      input.fiscalIngestId,
      input.competencia,
      input.valorApurado,
      input.idempotencyKey,
      input.correlationId ?? null,
      JSON.stringify(input.canonicalSnapshot)
    ]
  );
  const row = r.rows[0];
  if (!row) throw new Error("Falha ao inserir processamento_fiscal.");
  const inserted = row.inserted === true;
  const mapped = mapProc(row);
  if (inserted) {
    await insertProcessamentoEvento(client, mapped.id, "processamento_criado", {
      fiscal_ingest_id: input.fiscalIngestId,
      competencia: input.competencia
    });
  }
  return { ...mapped, inserted };
}

export async function getProcessamentoById(
  db: Pool | PoolClient,
  automacaoTenantId: string,
  processamentoId: string
): Promise<(ProcessamentoFiscalRow & { canonicalSnapshot: Record<string, unknown> }) | null> {
  try {
    const r = await db.query(
      `SELECT ${PROC_SELECT_COLS}, canonical_snapshot
       FROM fiscal.processamento_fiscal
       WHERE id = $1::uuid AND automacao_tenant_id = $2
       LIMIT 1`,
      [processamentoId, automacaoTenantId]
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      ...mapProc(row),
      canonicalSnapshot: (row.canonical_snapshot as Record<string, unknown>) ?? {}
    };
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
    throw error;
  }
}

export async function listProcessamentosForTenant(
  db: Pool | PoolClient,
  automacaoTenantId: string,
  limit = 50
): Promise<ProcessamentoFiscalRow[]> {
  try {
    const r = await db.query(
      `SELECT ${PROC_SELECT_COLS}
       FROM fiscal.processamento_fiscal
       WHERE automacao_tenant_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [automacaoTenantId, Math.min(Math.max(limit, 1), 100)]
    );
    return r.rows.map(mapProc);
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
    throw error;
  }
}

export async function listProcessamentoEventos(
  db: Pool | PoolClient,
  processamentoId: string
): Promise<ProcessamentoEventoRow[]> {
  const r = await db.query(
    `SELECT id::text, evento, payload, created_at
     FROM fiscal.processamento_evento
     WHERE processamento_id = $1::uuid
     ORDER BY created_at ASC`,
    [processamentoId]
  );
  return r.rows.map((row) => ({
    id: row.id,
    evento: row.evento,
    payload: (row.payload as Record<string, unknown>) ?? {},
    createdAt: row.created_at.toISOString()
  }));
}

export async function updateProcessamentoStatus(
  client: PoolClient,
  processamentoId: string,
  input: {
    status: ProcessamentoStatus;
    protocoloSerpro?: string | null;
    erroCodigo?: string | null;
    erroDetalhe?: Record<string, unknown> | null;
  }
): Promise<void> {
  await client.query(
    `UPDATE fiscal.processamento_fiscal SET
       status = $2,
       protocolo_serpro = COALESCE($3, protocolo_serpro),
       erro_codigo = $4,
       erro_detalhe = COALESCE($5::jsonb, erro_detalhe),
       updated_at = now()
     WHERE id = $1::uuid`,
    [
      processamentoId,
      input.status,
      input.protocoloSerpro ?? null,
      input.erroCodigo ?? null,
      input.erroDetalhe ? JSON.stringify(input.erroDetalhe) : null
    ]
  );
}

export async function updateProcessamentoRecibo(
  client: PoolClient,
  processamentoId: string,
  reciboStorageKey: string
): Promise<void> {
  await client.query(
    `UPDATE fiscal.processamento_fiscal
     SET recibo_storage_key = $2, status = 'RECIBO_OK', updated_at = now()
     WHERE id = $1::uuid`,
    [processamentoId, reciboStorageKey]
  );
}

export async function updateProcessamentoGuiaLink(
  client: PoolClient,
  processamentoId: string,
  guiaFiscalId: string
): Promise<void> {
  await client.query(
    `UPDATE fiscal.processamento_fiscal
     SET guia_fiscal_id = $2::uuid, status = 'CONCLUIDO', updated_at = now()
     WHERE id = $1::uuid`,
    [processamentoId, guiaFiscalId]
  );
}
