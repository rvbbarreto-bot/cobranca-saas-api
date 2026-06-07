import type { PoolClient } from "pg";
import type { GuiaReconciliationCandidate } from "../domain/match-guia-for-reconciliation";
import { normalizeLinhaDigitavel } from "../domain/schemas/fiscal-guia-reconciliation.schema";

export async function findGuiaPagamentoByReconciliationKey(
  client: PoolClient,
  automacaoTenantId: string,
  idempotencyKey: string
): Promise<{ id: string; guia_fiscal_id: string } | null> {
  const r = await client.query<{ id: string; guia_fiscal_id: string }>(
    `SELECT id::text AS id, guia_fiscal_id::text AS guia_fiscal_id
     FROM fiscal.guia_pagamento
     WHERE tenant_id = $1
       AND meio = 'conciliacao'
       AND metadata->>'reconciliation_idempotency_key' = $2
     LIMIT 1`,
    [automacaoTenantId, idempotencyKey]
  );
  return r.rows[0] ?? null;
}

export async function listGuiasForReconciliationMatch(
  client: PoolClient,
  automacaoTenantId: string,
  input: { guiaFiscalId?: string; linhaDigitavel?: string }
): Promise<GuiaReconciliationCandidate[]> {
  if (input.guiaFiscalId?.trim()) {
    const r = await client.query<{
      id: string;
      status: string;
      valor_total: string;
      linha_digitavel: string | null;
    }>(
      `SELECT id::text AS id, status, valor_total::text AS valor_total, linha_digitavel
       FROM fiscal.guia_fiscal
       WHERE tenant_id = $1 AND id = $2::uuid
       LIMIT 1`,
      [automacaoTenantId, input.guiaFiscalId.trim()]
    );
    return r.rows.map(mapRow);
  }

  const normalized = normalizeLinhaDigitavel(input.linhaDigitavel ?? "");
  if (!normalized) {
    return [];
  }

  const r = await client.query<{
    id: string;
    status: string;
    valor_total: string;
    linha_digitavel: string | null;
  }>(
    `SELECT id::text AS id, status, valor_total::text AS valor_total, linha_digitavel
     FROM fiscal.guia_fiscal
     WHERE tenant_id = $1
       AND regexp_replace(coalesce(linha_digitavel, ''), '\\D', '', 'g') = $2`,
    [automacaoTenantId, normalized]
  );
  return r.rows.map(mapRow);
}

function mapRow(row: {
  id: string;
  status: string;
  valor_total: string;
  linha_digitavel: string | null;
}): GuiaReconciliationCandidate {
  return {
    id: row.id,
    status: row.status as GuiaReconciliationCandidate["status"],
    valorTotal: Number(row.valor_total),
    linhaDigitavel: row.linha_digitavel
  };
}
