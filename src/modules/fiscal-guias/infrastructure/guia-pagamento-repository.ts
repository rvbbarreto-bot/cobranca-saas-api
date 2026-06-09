import type { PoolClient } from "pg";
import { evaluateGuiaFiscalStatusTransition } from "../domain/guia-fiscal-status-transition";
import type { GuiaFiscalStatus } from "../domain/schemas/guia-fiscal.schema";
import { getGuiaFiscalByIdForTenant } from "./guia-fiscal-repository";

export type GuiaPagamentoRow = {
  id: string;
  guia_fiscal_id: string;
  valor_pago: string;
  data_pagamento: string;
  meio: string;
  comprovante_url: string | null;
  created_at: Date;
};

export type GuiaFiscalPdfRow = {
  id: string;
  status: GuiaFiscalStatus;
  pdf_storage_key: string | null;
  pdf_url: string | null;
};

export async function getGuiaFiscalPdfMetaForTenant(
  tenantId: string,
  guiaId: string,
  client: PoolClient
): Promise<GuiaFiscalPdfRow | null> {
  const r = await client.query<GuiaFiscalPdfRow>(
    `SELECT id::text AS id, status, pdf_storage_key, pdf_url
     FROM fiscal.guia_fiscal
     WHERE tenant_id = $1 AND id = $2::uuid
     LIMIT 1`,
    [tenantId, guiaId]
  );
  return r.rows[0] ?? null;
}

export async function insertGuiaPagamentoAndMarkPago(
  client: PoolClient,
  input: {
    tenantId: string;
    guiaId: string;
    valorPago: number;
    dataPagamento: string;
    meio: string;
    comprovanteUrl?: string | null;
    metadata?: Record<string, string>;
  }
): Promise<{ pagamento: GuiaPagamentoRow; previousStatus: GuiaFiscalStatus } | null> {
  const guia = await getGuiaFiscalByIdForTenant(input.tenantId, input.guiaId, client);
  if (!guia) {
    return null;
  }

  const decision = evaluateGuiaFiscalStatusTransition(guia.status, "PAGO");
  if (decision !== "allow") {
    throw new Error(`Transicao ${guia.status} -> PAGO nao permitida.`);
  }

  const ins = await client.query<GuiaPagamentoRow>(
    `INSERT INTO fiscal.guia_pagamento (
       guia_fiscal_id, tenant_id, valor_pago, data_pagamento, meio, comprovante_url, metadata
     )
     VALUES ($1::uuid, $2, $3, $4::date, $5, $6, $7::jsonb)
     RETURNING
       id::text AS id,
       guia_fiscal_id::text AS guia_fiscal_id,
       valor_pago::text AS valor_pago,
       data_pagamento::text AS data_pagamento,
       meio,
       comprovante_url,
       created_at`,
    [
      input.guiaId,
      input.tenantId,
      input.valorPago,
      input.dataPagamento,
      input.meio,
      input.comprovanteUrl ?? null,
      JSON.stringify(input.metadata ?? {})
    ]
  );

  const pagamento = ins.rows[0];
  if (!pagamento) {
    throw new Error("Falha ao inserir guia_pagamento.");
  }

  await client.query(
    `UPDATE fiscal.guia_fiscal
     SET status = 'PAGO', updated_at = now()
     WHERE id = $1::uuid AND tenant_id = $2 AND status = $3`,
    [input.guiaId, input.tenantId, guia.status]
  );

  return { pagamento, previousStatus: guia.status };
}

export function mapGuiaPagamentoRowToResponse(row: GuiaPagamentoRow) {
  return {
    id: row.id,
    guia_fiscal_id: row.guia_fiscal_id,
    valor_pago: Number(row.valor_pago),
    data_pagamento: row.data_pagamento,
    meio: row.meio as "pix" | "boleto" | "manual" | "conciliacao",
    comprovante_url: row.comprovante_url,
    created_at: row.created_at.toISOString()
  };
}
