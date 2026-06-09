import { parsePortalClienteIdQuery } from "../domain/schemas/portal-cliente-query.schema";
import { portalClienteBelongsToTenant } from "../infrastructure/certificado-digital-repository";
import {
  getActiveProcuracaoForCliente,
  mapProcuracaoRowToResponse
} from "../infrastructure/procuracao-repository";

export async function getPortalProcuracaoUseCase(input: {
  tenantId: string;
  portalClienteId: string;
}): Promise<
  | { ok: true; procuracao: ReturnType<typeof mapProcuracaoRowToResponse> | null }
  | { ok: false; kind: "validation_error"; issues: import("zod").ZodIssue[] }
  | { ok: false; kind: "cliente_not_found" }
> {
  const parsed = parsePortalClienteIdQuery({ portal_cliente_id: input.portalClienteId });
  if (!parsed.ok) {
    return { ok: false, kind: "validation_error", issues: parsed.issues };
  }

  const belongs = await portalClienteBelongsToTenant(input.tenantId, parsed.value.portal_cliente_id);
  if (!belongs) {
    return { ok: false, kind: "cliente_not_found" };
  }

  const row = await getActiveProcuracaoForCliente(input.tenantId, parsed.value.portal_cliente_id);
  return { ok: true, procuracao: row ? mapProcuracaoRowToResponse(row) : null };
}
