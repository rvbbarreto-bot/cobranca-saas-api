import { mapGuiaFiscalRowToResponse } from "./map-guia-fiscal-row";
import { getGuiaFiscalByIdForTenant } from "../infrastructure/guia-fiscal-repository";

export async function getPortalGuiaFiscalUseCase(
  tenantId: string,
  guiaId: string
): Promise<{ ok: true; guia: ReturnType<typeof mapGuiaFiscalRowToResponse> } | { ok: false; kind: "not_found" }> {
  const row = await getGuiaFiscalByIdForTenant(tenantId, guiaId);
  if (!row) {
    return { ok: false, kind: "not_found" };
  }
  return { ok: true, guia: mapGuiaFiscalRowToResponse(row) };
}
