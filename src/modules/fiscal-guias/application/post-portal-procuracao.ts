import type { PoolClient } from "pg";
import { withTenantTransaction } from "../../../platform/persistence/with-tenant-transaction";
import { parsePostProcuracaoBody } from "../domain/schemas/procuracao.schema";
import { writeFiscalAuditLog } from "../infrastructure/fiscal-audit.service";
import { portalClienteBelongsToTenant } from "../infrastructure/certificado-digital-repository";
import {
  insertProcuracao,
  mapProcuracaoRowToResponse
} from "../infrastructure/procuracao-repository";

export async function postPortalProcuracaoUseCase(input: {
  tenantId: string;
  body: unknown;
  userId?: string;
}): Promise<
  | { ok: true; procuracao: ReturnType<typeof mapProcuracaoRowToResponse> }
  | { ok: false; kind: "validation_error"; issues: import("zod").ZodIssue[] }
  | { ok: false; kind: "cliente_not_found" }
> {
  const parsed = parsePostProcuracaoBody(input.body);
  if (!parsed.ok) {
    return { ok: false, kind: "validation_error", issues: parsed.issues };
  }

  const belongs = await portalClienteBelongsToTenant(
    input.tenantId,
    parsed.value.portal_cliente_id
  );
  if (!belongs) {
    return { ok: false, kind: "cliente_not_found" };
  }

  const row = await withTenantTransaction(input.tenantId, async (client: PoolClient) => {
    const proc = await insertProcuracao(client, {
      tenantId: input.tenantId,
      portalClienteId: parsed.value.portal_cliente_id,
      tipo: parsed.value.tipo,
      procuradorDocumento: parsed.value.procurador_documento,
      validadeInicio: parsed.value.validade_inicio,
      validadeFim: parsed.value.validade_fim,
      ativa: parsed.value.ativa,
      metadata: parsed.value.metadata as Record<string, unknown> | undefined
    });

    await writeFiscalAuditLog(
      {
        tenantId: input.tenantId,
        userId: input.userId,
        action: "admin_access",
        resourceType: "procuracao",
        resourceId: proc.id,
        newValue: {
          portal_cliente_id: parsed.value.portal_cliente_id,
          tipo: parsed.value.tipo,
          validade_fim: parsed.value.validade_fim
        }
      },
      client
    );

    return proc;
  });

  return { ok: true, procuracao: mapProcuracaoRowToResponse(row) };
}
