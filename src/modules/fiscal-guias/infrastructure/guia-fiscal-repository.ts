import type { Pool, PoolClient } from "pg";
import { getPool } from "../../../platform/persistence/pool";
import { rethrowFiscalSchemaError } from "./fiscal-schema";
import type { GuiaFiscalStatus, TipoGuia } from "../domain/schemas/guia-fiscal.schema";

export type GuiaFiscalKeysetCursor = { createdAtIso: string; id: string };

export type GuiaFiscalRow = {
  id: string;
  portal_cliente_id: string;
  tipo_guia: TipoGuia;
  competencia: string;
  data_vencimento: string | null;
  valor_principal: string;
  valor_multa: string;
  valor_juros: string;
  valor_total: string;
  linha_digitavel: string | null;
  pix_copia_cola: string | null;
  status: GuiaFiscalStatus;
  compliance_status: string;
  compliance_motivo: string | null;
  pdf_url: string | null;
  versao_atual: number;
  created_at: Date;
  updated_at: Date;
};

const GUIA_FISCAL_SELECT = `
  g.id::text AS id,
  g.portal_cliente_id::text AS portal_cliente_id,
  g.tipo_guia,
  g.competencia,
  g.data_vencimento::text AS data_vencimento,
  g.valor_principal::text AS valor_principal,
  g.valor_multa::text AS valor_multa,
  g.valor_juros::text AS valor_juros,
  g.valor_total::text AS valor_total,
  g.linha_digitavel,
  g.pix_copia_cola,
  g.status,
  g.compliance_status,
  g.compliance_motivo,
  g.pdf_url,
  g.versao_atual,
  g.created_at,
  g.updated_at
`;

const GUIA_FISCAL_RETURNING = `
  id::text AS id,
  portal_cliente_id::text AS portal_cliente_id,
  tipo_guia,
  competencia,
  data_vencimento::text AS data_vencimento,
  valor_principal::text AS valor_principal,
  valor_multa::text AS valor_multa,
  valor_juros::text AS valor_juros,
  valor_total::text AS valor_total,
  linha_digitavel,
  pix_copia_cola,
  status,
  compliance_status,
  compliance_motivo,
  pdf_url,
  versao_atual,
  created_at,
  updated_at
`;

export type InsertGuiaFiscalInput = {
  tenantId: string;
  portalClienteId: string;
  tipoGuia: TipoGuia;
  competencia: string;
  idempotencyKey: string;
  captureJobId?: string;
};

export async function findGuiaFiscalByIdempotency(
  tenantId: string,
  idempotencyKey: string,
  db: Pool | PoolClient = getPool()
): Promise<GuiaFiscalRow | null> {
  try {
    const r = await db.query<GuiaFiscalRow>(
      `SELECT ${GUIA_FISCAL_SELECT}
       FROM fiscal.guia_fiscal g
       WHERE g.tenant_id = $1 AND g.idempotency_key = $2
       LIMIT 1`,
      [tenantId, idempotencyKey]
    );
    return r.rows[0] ?? null;
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
  }
}

export async function insertGuiaFiscalProcessing(
  client: PoolClient,
  input: InsertGuiaFiscalInput
): Promise<GuiaFiscalRow> {
  const r = await client.query<GuiaFiscalRow>(
    `INSERT INTO fiscal.guia_fiscal (
       tenant_id, portal_cliente_id, tipo_guia, competencia,
       valor_principal, idempotency_key, status, compliance_status, capture_job_id
     )
     VALUES ($1, $2::uuid, $3, $4, 0, $5, 'PROCESSANDO', 'pendente', $6)
     ON CONFLICT (tenant_id, idempotency_key) DO UPDATE
       SET updated_at = now()
     RETURNING ${GUIA_FISCAL_RETURNING}`,
    [
      input.tenantId,
      input.portalClienteId,
      input.tipoGuia,
      input.competencia,
      input.idempotencyKey,
      input.captureJobId ?? null
    ]
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error("Falha ao inserir fiscal.guia_fiscal.");
  }
  return row;
}

export async function applyGuiaFiscalStubDisponivel(
  client: PoolClient,
  guiaId: string,
  tenantId: string
): Promise<GuiaFiscalRow | null> {
  const r = await client.query<GuiaFiscalRow>(
    `UPDATE fiscal.guia_fiscal g
     SET
       valor_principal = 150.00,
       valor_multa = 0,
       valor_juros = 0,
       data_vencimento = (date_trunc('month', CURRENT_DATE) + interval '1 month' + interval '19 days')::date,
       linha_digitavel = '85800000000150012340201234567890123456789012345',
       compliance_status = 'aprovado',
       compliance_motivo = NULL,
       status = 'DISPONIVEL',
       updated_at = now()
     WHERE g.id = $1::uuid AND g.tenant_id = $2
     RETURNING ${GUIA_FISCAL_RETURNING}`,
    [guiaId, tenantId]
  );
  return r.rows[0] ?? null;
}

export type ApplyGuiaFiscalDisponivelInput = {
  valorPrincipal: number;
  valorMulta: number;
  valorJuros: number;
  dataVencimento: string;
  linhaDigitavel: string;
  pixCopiaCola?: string | null;
  complianceStatus: string;
  complianceMotivo?: string | null;
  pdfUrl?: string | null;
  pdfStorageKey?: string | null;
};

export async function applyGuiaFiscalDisponivel(
  client: PoolClient,
  guiaId: string,
  tenantId: string,
  input: ApplyGuiaFiscalDisponivelInput
): Promise<GuiaFiscalRow | null> {
  const r = await client.query<GuiaFiscalRow>(
    `UPDATE fiscal.guia_fiscal g
     SET
       valor_principal = $3,
       valor_multa = $4,
       valor_juros = $5,
       data_vencimento = $6::date,
       linha_digitavel = $7,
       pix_copia_cola = $8,
       compliance_status = $9,
       compliance_motivo = $10,
       pdf_url = COALESCE($11, pdf_url),
       pdf_storage_key = COALESCE($12, pdf_storage_key),
       status = 'DISPONIVEL',
       updated_at = now()
     WHERE g.id = $1::uuid AND g.tenant_id = $2 AND g.status = 'PROCESSANDO'
     RETURNING ${GUIA_FISCAL_RETURNING}`,
    [
      guiaId,
      tenantId,
      input.valorPrincipal,
      input.valorMulta,
      input.valorJuros,
      input.dataVencimento,
      input.linhaDigitavel,
      input.pixCopiaCola ?? null,
      input.complianceStatus,
      input.complianceMotivo ?? null,
      input.pdfUrl ?? null,
      input.pdfStorageKey ?? null
    ]
  );
  return r.rows[0] ?? null;
}

export async function applyGuiaFiscalComplianceBlocked(
  client: PoolClient,
  guiaId: string,
  tenantId: string,
  motivo: string
): Promise<GuiaFiscalRow | null> {
  const r = await client.query<GuiaFiscalRow>(
    `UPDATE fiscal.guia_fiscal g
     SET
       compliance_status = 'bloqueado',
       compliance_motivo = $3,
       updated_at = now()
     WHERE g.id = $1::uuid AND g.tenant_id = $2 AND g.status = 'PROCESSANDO'
     RETURNING ${GUIA_FISCAL_RETURNING}`,
    [guiaId, tenantId, motivo]
  );
  return r.rows[0] ?? null;
}

export async function markGuiaFiscalCaptureFailed(
  client: PoolClient,
  guiaId: string,
  tenantId: string,
  motivo: string
): Promise<void> {
  await client.query(
    `UPDATE fiscal.guia_fiscal g
     SET
       status = 'CANCELADO',
       compliance_status = 'bloqueado',
       compliance_motivo = $3,
       updated_at = now()
     WHERE g.id = $1::uuid AND g.tenant_id = $2 AND g.status = 'PROCESSANDO'`,
    [guiaId, tenantId, motivo]
  );
}

export async function getGuiaFiscalByIdForTenant(
  tenantId: string,
  guiaId: string,
  pool: Pool | PoolClient = getPool()
): Promise<GuiaFiscalRow | null> {
  try {
    const r = await pool.query<GuiaFiscalRow>(
      `SELECT ${GUIA_FISCAL_SELECT}
       FROM fiscal.guia_fiscal g
       WHERE g.tenant_id = $1 AND g.id = $2::uuid
       LIMIT 1`,
      [tenantId, guiaId]
    );
    return r.rows[0] ?? null;
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
  }
}

export type ListGuiasFiscaisFilter = {
  status?: GuiaFiscalStatus;
  tipo_guia?: TipoGuia;
  portal_cliente_id?: string;
  competencia?: string;
};

export async function listGuiasFiscaisByTenantPage(
  tenantId: string,
  options: {
    limit: number;
    cursor?: GuiaFiscalKeysetCursor | null;
    filter?: ListGuiasFiscaisFilter;
  },
  pool: Pool = getPool()
): Promise<{ items: GuiaFiscalRow[]; has_more: boolean }> {
  const lim = Math.min(Math.max(Math.floor(options.limit), 1), 200);
  const fetchN = lim + 1;
  const f = options.filter ?? {};

  const params: unknown[] = [tenantId];
  const where: string[] = ["g.tenant_id = $1"];

  if (f.status) {
    params.push(f.status);
    where.push(`g.status = $${params.length}`);
  }
  if (f.tipo_guia) {
    params.push(f.tipo_guia);
    where.push(`g.tipo_guia = $${params.length}`);
  }
  if (f.portal_cliente_id) {
    params.push(f.portal_cliente_id);
    where.push(`g.portal_cliente_id = $${params.length}::uuid`);
  }
  if (f.competencia) {
    params.push(f.competencia);
    where.push(`g.competencia = $${params.length}`);
  }

  if (options.cursor) {
    params.push(options.cursor.createdAtIso, options.cursor.id);
    const caIdx = params.length - 1;
    const idIdx = params.length;
    where.push(
      `(g.created_at, g.id) < ($${caIdx}::timestamptz, $${idIdx}::uuid)`
    );
  }

  params.push(fetchN);
  const limitIdx = params.length;

  const sql = `
    SELECT
      ${GUIA_FISCAL_SELECT}
    FROM fiscal.guia_fiscal g
    WHERE ${where.join(" AND ")}
    ORDER BY g.created_at DESC, g.id DESC
    LIMIT $${limitIdx}
  `;

  try {
    const r = await pool.query<GuiaFiscalRow>(sql, params);
    const has_more = r.rows.length > lim;
    const items = has_more ? r.rows.slice(0, lim) : r.rows;
    return { items, has_more };
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
  }
}

export async function countGuiasFiscaisByTenant(
  tenantId: string,
  pool: Pool = getPool()
): Promise<number> {
  try {
    const r = await pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM fiscal.guia_fiscal WHERE tenant_id = $1`,
      [tenantId]
    );
    return Number(r.rows[0]?.n ?? 0);
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
  }
}
