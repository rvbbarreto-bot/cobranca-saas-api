import { parsePortalClienteIdQuery } from "../domain/schemas/portal-cliente-query.schema";
import { mapCertificadoRowToResponse } from "./map-certificado-row";
import {
  getActiveCertificadoMetaForCliente,
  portalClienteBelongsToTenant
} from "../infrastructure/certificado-digital-repository";

export async function getPortalCertificadoDigitalUseCase(input: {
  tenantId: string;
  portalClienteId: string;
}): Promise<
  | { ok: true; certificado: ReturnType<typeof mapCertificadoRowToResponse> | null }
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

  const row = await getActiveCertificadoMetaForCliente(input.tenantId, parsed.value.portal_cliente_id);
  return { ok: true, certificado: row ? mapCertificadoRowToResponse(row) : null };
}
