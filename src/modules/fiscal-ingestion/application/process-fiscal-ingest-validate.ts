import type { Pool } from "pg";
import { getPool } from "../../../platform/persistence/pool";
import { csvIngestionAdapter } from "../domain/csv-ingestion-adapter";
import type { CanonicalApuracao, IngestLineError } from "../domain/canonical-apuracao.schema";
import {
  findPortalClienteIdByCnpj,
  getFiscalIngestById,
  updateFiscalIngestValidation
} from "../infrastructure/fiscal-ingest-repository";

export type FiscalIngestValidateJobPayload = {
  ingestId: string;
  automacaoTenantId: string;
};

async function enrichWithPortalClienteIds(
  db: Pool,
  automacaoTenantId: string,
  rows: CanonicalApuracao[],
  errors: IngestLineError[]
): Promise<CanonicalApuracao[]> {
  const valid: CanonicalApuracao[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const linha = row.metadata?.sourceLine ?? i + 2;
    const clienteId = await findPortalClienteIdByCnpj(db, automacaoTenantId, row.cnpj);
    if (!clienteId) {
      errors.push({
        linha,
        campo: "cnpj",
        codigo: "CNPJ_NAO_CADASTRADO",
        mensagem: "CNPJ nao encontrado em portal.cliente do escritorio."
      });
      continue;
    }
    valid.push({
      ...row,
      metadata: { ...row.metadata, portalClienteId: clienteId }
    });
  }

  return valid;
}

export async function processFiscalIngestValidateJob(
  payload: FiscalIngestValidateJobPayload
): Promise<void> {
  const pool = getPool();
  const ingest = await getFiscalIngestById(pool, payload.automacaoTenantId, payload.ingestId);
  if (!ingest) {
    throw new Error(`Fiscal ingest ${payload.ingestId} nao encontrado.`);
  }

  if (ingest.status !== "VALIDANDO") {
    return;
  }

  const parsed = csvIngestionAdapter.parse(ingest.rawContent);
  const allErrors = [...parsed.errors];

  const validRows = await enrichWithPortalClienteIds(pool, payload.automacaoTenantId, parsed.rows, allErrors);

  const status = validRows.length > 0 && allErrors.length === 0 ? "VALIDADO" : "ERRO";
  const finalValid = status === "VALIDADO" ? validRows : [];
  const errorCount = allErrors.length + (parsed.rowCount - validRows.length - parsed.errors.length);

  const client = await pool.connect();
  try {
    await updateFiscalIngestValidation(client, payload.ingestId, {
      status,
      rowCount: parsed.rowCount,
      validCount: finalValid.length,
      errorCount: Math.max(allErrors.length, parsed.rowCount - finalValid.length),
      validationErrors: allErrors,
      canonicalRows: finalValid
    });
  } finally {
    client.release();
  }
}
