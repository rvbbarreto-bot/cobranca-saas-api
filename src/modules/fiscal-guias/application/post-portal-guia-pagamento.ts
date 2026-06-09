import type { PoolClient } from "pg";
import { withTenantTransaction } from "../../../platform/persistence/with-tenant-transaction";
import { parsePostGuiaPagamentoBody } from "../domain/schemas/guia-pagamento.schema";
import { writeFiscalAuditLog } from "../infrastructure/fiscal-audit.service";
import {
  insertGuiaPagamentoAndMarkPago,
  mapGuiaPagamentoRowToResponse
} from "../infrastructure/guia-pagamento-repository";

export async function postPortalGuiaPagamentoUseCase(input: {
  tenantId: string;
  guiaId: string;
  body: unknown;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<
  | { ok: true; pagamento: ReturnType<typeof mapGuiaPagamentoRowToResponse>; guia_status: "PAGO" }
  | { ok: false; kind: "validation_error"; issues: import("zod").ZodIssue[] }
  | { ok: false; kind: "not_found" }
  | { ok: false; kind: "transition_denied"; message: string }
> {
  const parsed = parsePostGuiaPagamentoBody(input.body);
  if (!parsed.ok) {
    return { ok: false, kind: "validation_error", issues: parsed.issues };
  }

  try {
    const result = await withTenantTransaction(input.tenantId, async (client: PoolClient) => {
      const applied = await insertGuiaPagamentoAndMarkPago(client, {
        tenantId: input.tenantId,
        guiaId: input.guiaId,
        valorPago: parsed.value.valor_pago,
        dataPagamento: parsed.value.data_pagamento,
        meio: parsed.value.meio,
        comprovanteUrl: parsed.value.comprovante_url
      });

      if (!applied) {
        return null;
      }

      await writeFiscalAuditLog(
        {
          tenantId: input.tenantId,
          userId: input.userId,
          action: "status_change",
          resourceType: "guia_fiscal",
          resourceId: input.guiaId,
          oldValue: { status: applied.previousStatus },
          newValue: { status: "PAGO", pagamento_id: applied.pagamento.id },
          ipAddress: input.ipAddress,
          userAgent: input.userAgent
        },
        client
      );

      return applied.pagamento;
    });

    if (!result) {
      return { ok: false, kind: "not_found" };
    }

    return {
      ok: true,
      pagamento: mapGuiaPagamentoRowToResponse(result),
      guia_status: "PAGO"
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Transicao") || message.includes("nao permitida")) {
      return { ok: false, kind: "transition_denied", message };
    }
    throw error;
  }
}
