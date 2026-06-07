import type { Pool, PoolClient } from "pg";
import type { CanonicalApuracao, IngestLineError } from "../domain/canonical-apuracao.schema";
import { rethrowFiscalSchemaError } from "../../fiscal-guias/infrastructure/fiscal-schema";

export type FiscalIngestStatus = "VALIDANDO" | "VALIDADO" | "ERRO";

export type FiscalIngestRow = {
  id: string;
  organizationId: string;
  automacaoTenantId: string;
  sourceType: string;
  status: FiscalIngestStatus;
  originalFilename: string | null;
  rowCount: number;
  validCount: number;
  errorCount: number;
  validationErrors: IngestLineError[];
  canonicalRows: CanonicalApuracao[];
  createdAt: string;
  updatedAt: string;
};

function mapRow(row: {
  id: string;
  organization_id: string;
  automacao_tenant_id: string;
  source_type: string;
  status: string;
  original_filename: string | null;
  row_count: number;
  valid_count: number;
  error_count: number;
  validation_errors: IngestLineError[] | null;
  canonical_rows: CanonicalApuracao[] | null;
  created_at: Date;
  updated_at: Date;
}): FiscalIngestRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    automacaoTenantId: row.automacao_tenant_id,
    sourceType: row.source_type,
    status: row.status as FiscalIngestStatus,
    originalFilename: row.original_filename,
    rowCount: row.row_count,
    validCount: row.valid_count,
    errorCount: row.error_count,
    validationErrors: row.validation_errors ?? [],
    canonicalRows: row.canonical_rows ?? [],
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  };
}

export async function insertFiscalIngest(
  client: PoolClient,
  input: {
    organizationId: string;
    automacaoTenantId: string;
    uploadedByUserId?: string;
    originalFilename?: string;
    rawContent: string;
  }
): Promise<FiscalIngestRow> {
  try {
    const r = await client.query(
      `INSERT INTO fiscal.fiscal_ingest (
         organization_id, automacao_tenant_id, uploaded_by_user_id,
         source_type, status, original_filename, raw_content
       ) VALUES ($1::uuid, $2, $3::uuid, 'csv', 'VALIDANDO', $4, $5)
       RETURNING
         id::text, organization_id::text, automacao_tenant_id, source_type, status,
         original_filename, row_count, valid_count, error_count,
         validation_errors, canonical_rows, created_at, updated_at`,
      [
        input.organizationId,
        input.automacaoTenantId,
        input.uploadedByUserId ?? null,
        input.originalFilename ?? null,
        input.rawContent
      ]
    );
    return mapRow(r.rows[0]);
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
    throw error;
  }
}

export async function getFiscalIngestById(
  db: Pool | PoolClient,
  automacaoTenantId: string,
  ingestId: string
): Promise<(FiscalIngestRow & { rawContent: string }) | null> {
  try {
    const r = await db.query(
      `SELECT
         id::text, organization_id::text, automacao_tenant_id, source_type, status,
         original_filename, row_count, valid_count, error_count,
         validation_errors, canonical_rows, raw_content, created_at, updated_at
       FROM fiscal.fiscal_ingest
       WHERE id = $1::uuid AND automacao_tenant_id = $2
       LIMIT 1`,
      [ingestId, automacaoTenantId]
    );
    const row = r.rows[0];
    if (!row) return null;
    return { ...mapRow(row), rawContent: row.raw_content as string };
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
    throw error;
  }
}

export async function getFiscalIngestPublicById(
  db: Pool | PoolClient,
  automacaoTenantId: string,
  ingestId: string
): Promise<FiscalIngestRow | null> {
  const row = await getFiscalIngestById(db, automacaoTenantId, ingestId);
  if (!row) return null;
  const { rawContent: _r, ...pub } = row;
  return pub;
}

export async function updateFiscalIngestValidation(
  client: PoolClient,
  ingestId: string,
  input: {
    status: FiscalIngestStatus;
    rowCount: number;
    validCount: number;
    errorCount: number;
    validationErrors: IngestLineError[];
    canonicalRows: CanonicalApuracao[];
  }
): Promise<void> {
  await client.query(
    `UPDATE fiscal.fiscal_ingest SET
       status = $2,
       row_count = $3,
       valid_count = $4,
       error_count = $5,
       validation_errors = $6::jsonb,
       canonical_rows = $7::jsonb,
       updated_at = now()
     WHERE id = $1::uuid`,
    [
      ingestId,
      input.status,
      input.rowCount,
      input.validCount,
      input.errorCount,
      JSON.stringify(input.validationErrors),
      JSON.stringify(input.canonicalRows)
    ]
  );
}

export async function findPortalClienteIdByCnpj(
  db: Pool | PoolClient,
  automacaoTenantId: string,
  cnpj: string
): Promise<string | null> {
  const r = await db.query<{ id: string }>(
    `SELECT id::text AS id FROM portal.cliente
     WHERE tenant_id = $1 AND regexp_replace(documento, '\\D', '', 'g') = $2
     LIMIT 1`,
    [automacaoTenantId, cnpj]
  );
  return r.rows[0]?.id ?? null;
}
