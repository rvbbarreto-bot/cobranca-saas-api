import type { PoolClient } from "pg";
import { matchGuiaForReconciliation } from "../domain/match-guia-for-reconciliation";
import type { FiscalGuiaReconciliationInboxPayload } from "../domain/schemas/fiscal-guia-reconciliation.schema";
import { writeFiscalAuditLog } from "../infrastructure/fiscal-audit.service";
import { insertGuiaPagamentoAndMarkPago } from "../infrastructure/guia-pagamento-repository";
import {
  findGuiaPagamentoByReconciliationKey,
  listGuiasForReconciliationMatch
} from "../infrastructure/guia-reconciliation-repository";

export type ApplyFiscalGuiaReconciliationResult =
  | { kind: "applied"; guiaId: string; pagamentoId: string }
  | { kind: "already_applied"; guiaId: string; pagamentoId: string }
  | { kind: "guia_not_found" }
  | { kind: "guia_ambiguous" }
  | { kind: "valor_mismatch" }
  | { kind: "transition_denied"; message: string };

export async function applyFiscalGuiaReconciliation(
  client: PoolClient,
  automacaoTenantId: string,
  payload: FiscalGuiaReconciliationInboxPayload
): Promise<ApplyFiscalGuiaReconciliationResult> {
  const existing = await findGuiaPagamentoByReconciliationKey(
    client,
    automacaoTenantId,
    payload.idempotency_key
  );
  if (existing) {
    return {
      kind: "already_applied",
      guiaId: existing.guia_fiscal_id,
      pagamentoId: existing.id
    };
  }

  const candidates = await listGuiasForReconciliationMatch(client, automacaoTenantId, {
    guiaFiscalId: payload.guia_fiscal_id,
    linhaDigitavel: payload.linha_digitavel
  });

  const matched = matchGuiaForReconciliation({
    guiaFiscalId: payload.guia_fiscal_id,
    linhaDigitavel: payload.linha_digitavel,
    valorPago: payload.valor_pago,
    candidates
  });

  if (!matched.ok) {
    if (matched.reason === "transition_denied") {
      return { kind: "transition_denied", message: "Transicao para PAGO nao permitida." };
    }
    return { kind: matched.reason };
  }

  const metadata: Record<string, string> = {
    reconciliation_idempotency_key: payload.idempotency_key
  };
  if (payload.referencia_externa?.trim()) {
    metadata.referencia_externa = payload.referencia_externa.trim();
  }

  try {
    const applied = await insertGuiaPagamentoAndMarkPago(client, {
      tenantId: automacaoTenantId,
      guiaId: matched.guiaId,
      valorPago: payload.valor_pago,
      dataPagamento: payload.data_pagamento,
      meio: "conciliacao",
      comprovanteUrl: payload.comprovante_url ?? null,
      metadata
    });

    if (!applied) {
      return { kind: "guia_not_found" };
    }

    await writeFiscalAuditLog(
      {
        tenantId: automacaoTenantId,
        action: "status_change",
        resourceType: "guia_fiscal",
        resourceId: matched.guiaId,
        oldValue: { status: applied.previousStatus },
        newValue: {
          status: "PAGO",
          pagamento_id: applied.pagamento.id,
          meio: "conciliacao",
          reconciliation_idempotency_key: payload.idempotency_key,
          referencia_externa: payload.referencia_externa ?? null
        }
      },
      client
    );

    return { kind: "applied", guiaId: matched.guiaId, pagamentoId: applied.pagamento.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Transicao") || message.includes("nao permitida")) {
      return { kind: "transition_denied", message };
    }
    throw error;
  }
}
