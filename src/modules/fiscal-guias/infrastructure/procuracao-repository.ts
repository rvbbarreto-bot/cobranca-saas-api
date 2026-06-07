import type { Pool, PoolClient } from "pg";
import { getPool } from "../../../platform/persistence/pool";
import { rethrowFiscalSchemaError } from "./fiscal-schema";

export type ProcuracaoRow = {
  id: string;
  portal_cliente_id: string;
  tipo: "ecac" | "receita_federal" | "outro";
  procurador_documento: string;
  validade_inicio: string;
  validade_fim: string;
  ativa: boolean;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

export async function insertProcuracao(
  client: PoolClient,
  input: {
    tenantId: string;
    portalClienteId: string;
    tipo: "ecac" | "receita_federal" | "outro";
    procuradorDocumento: string;
    validadeInicio: string;
    validadeFim: string;
    ativa: boolean;
    metadata?: Record<string, unknown>;
  }
): Promise<ProcuracaoRow> {
  const r = await client.query<ProcuracaoRow>(
    `INSERT INTO fiscal.procuracao (
       tenant_id, portal_cliente_id, tipo, procurador_documento,
       validade_inicio, validade_fim, ativa, metadata
     )
     VALUES ($1, $2::uuid, $3, $4, $5::date, $6::date, $7, $8::jsonb)
     RETURNING
       id::text AS id,
       portal_cliente_id::text AS portal_cliente_id,
       tipo,
       procurador_documento,
       validade_inicio::text AS validade_inicio,
       validade_fim::text AS validade_fim,
       ativa,
       metadata,
       created_at,
       updated_at`,
    [
      input.tenantId,
      input.portalClienteId,
      input.tipo,
      input.procuradorDocumento,
      input.validadeInicio,
      input.validadeFim,
      input.ativa,
      JSON.stringify(input.metadata ?? {})
    ]
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error("Falha ao inserir procuracao.");
  }
  return row;
}

export async function getActiveProcuracaoForCliente(
  tenantId: string,
  portalClienteId: string,
  db: Pool | PoolClient = getPool()
): Promise<ProcuracaoRow | null> {
  try {
    const r = await db.query<ProcuracaoRow>(
      `SELECT
         id::text AS id,
         portal_cliente_id::text AS portal_cliente_id,
         tipo,
         procurador_documento,
         validade_inicio::text AS validade_inicio,
         validade_fim::text AS validade_fim,
         ativa,
         metadata,
         created_at,
         updated_at
       FROM fiscal.procuracao
       WHERE tenant_id = $1
         AND portal_cliente_id = $2::uuid
         AND ativa = true
         AND validade_fim >= CURRENT_DATE
       ORDER BY validade_fim DESC, created_at DESC
       LIMIT 1`,
      [tenantId, portalClienteId]
    );
    return r.rows[0] ?? null;
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
  }
}

export function mapProcuracaoRowToResponse(row: ProcuracaoRow) {
  return {
    id: row.id,
    portal_cliente_id: row.portal_cliente_id,
    tipo: row.tipo,
    procurador_documento: row.procurador_documento,
    validade_inicio: row.validade_inicio,
    validade_fim: row.validade_fim,
    ativa: row.ativa,
    metadata: row.metadata,
    created_at: row.created_at.toISOString(),
    updated_at: row.updated_at.toISOString()
  };
}
