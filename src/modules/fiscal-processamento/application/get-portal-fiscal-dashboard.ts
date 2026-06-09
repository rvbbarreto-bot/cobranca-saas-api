import { getPool } from "../../../platform/persistence/pool";
import { listPortalExpiringCertificatesUseCase } from "../../fiscal-guias/application/list-portal-expiring-certificates";
import { getProcessamentoDashboardStats } from "../infrastructure/processamento-fiscal-repository";
import { mapProcessamentoPublic } from "./create-processamentos-from-ingest";

export async function getPortalFiscalDashboardUseCase(automacaoTenantId: string) {
  const stats = await getProcessamentoDashboardStats(getPool(), automacaoTenantId);
  const certificados = await listPortalExpiringCertificatesUseCase(automacaoTenantId);

  return {
    competencia_atual: stats.competenciaAtual,
    kpis: {
      processamentos_mes: stats.processamentosMes,
      erros_abertos: stats.errosAbertos,
      certificados_expirando: certificados.length
    },
    ultimos_processamentos: stats.ultimosProcessamentos.map(mapProcessamentoPublic),
    certificados_expirando: certificados.slice(0, 5)
  };
}
