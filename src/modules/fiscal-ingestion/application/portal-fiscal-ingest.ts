import { getOrganizationByAutomacaoTenantId } from "../../exeq-platform/infrastructure/organization-repository";
import { getPool } from "../../../platform/persistence/pool";
import { scheduleFiscalIngestValidateJob } from "../../../platform/jobs/enqueue-fiscal-ingest-validate";
import {
  getFiscalIngestPublicById,
  insertFiscalIngest,
  type FiscalIngestRow
} from "../infrastructure/fiscal-ingest-repository";

export async function postPortalIngestCsvUseCase(input: {
  automacaoTenantId: string;
  uploadedByUserId?: string;
  originalFilename?: string;
  rawContent: string;
}): Promise<
  | { ok: true; ingest: FiscalIngestRow }
  | { ok: false; kind: "organization_not_found" }
  | { ok: false; kind: "empty_file" }
> {
  if (!input.rawContent.trim()) {
    return { ok: false, kind: "empty_file" };
  }

  const pool = getPool();
  const org = await getOrganizationByAutomacaoTenantId(pool, input.automacaoTenantId);
  if (!org) {
    return { ok: false, kind: "organization_not_found" };
  }

  const client = await pool.connect();
  let ingest: FiscalIngestRow;
  try {
    ingest = await insertFiscalIngest(client, {
      organizationId: org.id,
      automacaoTenantId: input.automacaoTenantId,
      uploadedByUserId: input.uploadedByUserId,
      originalFilename: input.originalFilename,
      rawContent: input.rawContent
    });
  } finally {
    client.release();
  }

  scheduleFiscalIngestValidateJob({
    ingestId: ingest.id,
    automacaoTenantId: input.automacaoTenantId
  });

  return { ok: true, ingest };
}

export async function getPortalIngestStatusUseCase(
  automacaoTenantId: string,
  ingestId: string
): Promise<{ ok: true; ingest: FiscalIngestRow } | { ok: false; kind: "not_found" }> {
  const row = await getFiscalIngestPublicById(getPool(), automacaoTenantId, ingestId);
  if (!row) {
    return { ok: false, kind: "not_found" };
  }
  return { ok: true, ingest: row };
}

export function mapIngestPublic(ingest: FiscalIngestRow) {
  return {
    id: ingest.id,
    status: ingest.status,
    source_type: ingest.sourceType,
    original_filename: ingest.originalFilename,
    row_count: ingest.rowCount,
    valid_count: ingest.validCount,
    error_count: ingest.errorCount,
    validation_errors: ingest.validationErrors,
    canonical_rows:
      ingest.status === "VALIDADO"
        ? ingest.canonicalRows.map((r) => ({
            cnpj: r.cnpj,
            competencia: r.competencia,
            receita_bruta_mes: r.receitaBrutaMes,
            valor_total_das: r.valorTotalDas,
            portal_cliente_id: r.metadata?.portalClienteId ?? null
          }))
        : [],
    created_at: ingest.createdAt,
    updated_at: ingest.updatedAt
  };
}
