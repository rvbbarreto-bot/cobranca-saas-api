import type { PoolClient } from "pg";
import { writeFiscalAuditLog, type FiscalAuditAction } from "../../fiscal-guias/infrastructure/fiscal-audit.service";

export type ProcessamentoApuracaoAuditAction = "apuracao_iniciada" | "transmitida" | "erro_serpro";

export async function writeProcessamentoApuracaoAudit(
  client: PoolClient,
  input: {
    tenantId: string;
    processamentoId: string;
    action: ProcessamentoApuracaoAuditAction;
    correlationId?: string | null;
    userId?: string | null;
    payload?: Record<string, unknown>;
  }
): Promise<void> {
  const newValue: Record<string, unknown> = {
    ...(input.payload ?? {}),
    ...(input.correlationId ? { correlation_id: input.correlationId } : {})
  };

  await writeFiscalAuditLog(
    {
      tenantId: input.tenantId,
      userId: input.userId ?? undefined,
      action: input.action as FiscalAuditAction,
      resourceType: "processamento_fiscal",
      resourceId: input.processamentoId,
      newValue: Object.keys(newValue).length > 0 ? newValue : undefined
    },
    client
  );
}
