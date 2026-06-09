import type { CanonicalApuracao } from "../../fiscal-ingestion/domain/canonical-apuracao.schema";
import { getFiscalIngestPublicById } from "../../fiscal-ingestion/infrastructure/fiscal-ingest-repository";
import { getOrganizationByAutomacaoTenantId } from "../../exeq-platform/infrastructure/organization-repository";
import { getPool } from "../../../platform/persistence/pool";
import { scheduleSerproTransmitJob } from "../../../platform/jobs/enqueue-serpro-transmit";
import {
  insertProcessamentoFiscal,
  type ProcessamentoFiscalRow
} from "../infrastructure/processamento-fiscal-repository";
import { writeProcessamentoApuracaoAudit } from "./write-processamento-apuracao-audit";

export async function createProcessamentosFromIngestUseCase(input: {
  automacaoTenantId: string;
  fiscalIngestId: string;
  correlationId?: string;
  userId?: string;
}): Promise<
  | { ok: true; processamentos: ProcessamentoFiscalRow[] }
  | { ok: false; kind: "ingest_not_found" }
  | { ok: false; kind: "ingest_not_validado" }
  | { ok: false; kind: "organization_not_found" }
  | { ok: false; kind: "no_rows" }
> {
  const pool = getPool();
  const ingest = await getFiscalIngestPublicById(pool, input.automacaoTenantId, input.fiscalIngestId);
  if (!ingest) {
    return { ok: false, kind: "ingest_not_found" };
  }
  if (ingest.status !== "VALIDADO") {
    return { ok: false, kind: "ingest_not_validado" };
  }
  if (ingest.canonicalRows.length === 0) {
    return { ok: false, kind: "no_rows" };
  }

  const org = await getOrganizationByAutomacaoTenantId(pool, input.automacaoTenantId);
  if (!org) {
    return { ok: false, kind: "organization_not_found" };
  }

  const client = await pool.connect();
  const created: ProcessamentoFiscalRow[] = [];
  try {
    for (const row of ingest.canonicalRows as CanonicalApuracao[]) {
      const portalClienteId = row.metadata?.portalClienteId;
      if (!portalClienteId) continue;

      const { inserted, ...proc } = await insertProcessamentoFiscal(client, {
        organizationId: org.id,
        automacaoTenantId: input.automacaoTenantId,
        portalClienteId,
        fiscalIngestId: input.fiscalIngestId,
        competencia: row.competencia,
        valorApurado: row.valorTotalDas,
        idempotencyKey: `${input.fiscalIngestId}:${row.cnpj}:${row.competencia}`,
        canonicalSnapshot: row as unknown as Record<string, unknown>,
        correlationId: input.correlationId
      });
      created.push(proc);

      if (inserted) {
        await writeProcessamentoApuracaoAudit(client, {
          tenantId: input.automacaoTenantId,
          processamentoId: proc.id,
          action: "apuracao_iniciada",
          correlationId: input.correlationId,
          userId: input.userId,
          payload: {
            fiscal_ingest_id: input.fiscalIngestId,
            competencia: row.competencia,
            cnpj: row.cnpj
          }
        });
        scheduleSerproTransmitJob({
          processamentoId: proc.id,
          automacaoTenantId: input.automacaoTenantId
        });
      }
    }
  } finally {
    client.release();
  }

  if (created.length === 0) {
    return { ok: false, kind: "no_rows" };
  }

  return { ok: true, processamentos: created };
}

export function mapProcessamentoPublic(row: ProcessamentoFiscalRow) {
  return {
    id: row.id,
    portal_cliente_id: row.portalClienteId,
    fiscal_ingest_id: row.fiscalIngestId,
    competencia: row.competencia,
    tipo: row.tipo,
    status: row.status,
    valor_apurado: row.valorApurado,
    protocolo_serpro: row.protocoloSerpro,
    recibo_disponivel: Boolean(row.reciboStorageKey),
    guia_fiscal_id: row.guiaFiscalId,
    erro_codigo: row.erroCodigo,
    created_at: row.createdAt,
    updated_at: row.updatedAt
  };
}
