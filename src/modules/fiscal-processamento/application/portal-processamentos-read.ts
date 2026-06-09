import { getPool } from "../../../platform/persistence/pool";
import {
  getProcessamentoById,
  listProcessamentoEventos,
  listProcessamentosForTenant
} from "../infrastructure/processamento-fiscal-repository";

export async function listPortalProcessamentosUseCase(automacaoTenantId: string, limit?: number) {
  return listProcessamentosForTenant(getPool(), automacaoTenantId, limit);
}

export async function getPortalProcessamentoDetailUseCase(
  automacaoTenantId: string,
  processamentoId: string
) {
  const proc = await getProcessamentoById(getPool(), automacaoTenantId, processamentoId);
  if (!proc) {
    return { ok: false as const, kind: "not_found" as const };
  }
  const eventos = await listProcessamentoEventos(getPool(), processamentoId);
  const { canonicalSnapshot: _snap, ...row } = proc;
  return {
    ok: true as const,
    processamento: row,
    eventos
  };
}
