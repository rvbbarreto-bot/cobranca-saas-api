import type { PoolClient } from "pg";
import { isFiscalGuiasEnabled } from "../../../platform/config/fiscal-guias-enabled";
import {
  applyFiscalGuiaReconciliation,
  type ApplyFiscalGuiaReconciliationResult
} from "./apply-fiscal-guia-reconciliation";
import { resolveAutomacaoTenantForPublicTenant } from "./resolve-automacao-tenant-for-public-tenant";
import {
  parseFiscalGuiaReconciliationInboxPayload,
  type FiscalGuiaReconciliationInboxPayload
} from "../domain/schemas/fiscal-guia-reconciliation.schema";

export type FiscalReconciliationInboxHandleResult =
  | { kind: "not_fiscal" }
  | { kind: "disabled" }
  | { kind: "tenant_not_linked" }
  | { kind: "invalid"; issues: string[] }
  | ApplyFiscalGuiaReconciliationResult;

export function tryParseFiscalGuiaReconciliationInboxPayload(
  payload: unknown
): FiscalGuiaReconciliationInboxPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const eventType = (payload as { event_type?: unknown }).event_type;
  if (eventType !== "fiscal.guia.reconciliation.requested") {
    return null;
  }
  const parsed = parseFiscalGuiaReconciliationInboxPayload(payload);
  if (!parsed.ok) {
    return null;
  }
  return parsed.value;
}

export async function handleFiscalGuiaReconciliationInboxPayload(
  publicTenantUuid: string,
  payload: unknown,
  client: PoolClient
): Promise<FiscalReconciliationInboxHandleResult> {
  const fiscalPayload = tryParseFiscalGuiaReconciliationInboxPayload(payload);
  if (!fiscalPayload) {
    return { kind: "not_fiscal" };
  }

  if (!isFiscalGuiasEnabled()) {
    return { kind: "disabled" };
  }

  const strict = parseFiscalGuiaReconciliationInboxPayload(payload);
  if (!strict.ok) {
    return {
      kind: "invalid",
      issues: strict.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
    };
  }

  const automacaoTenantId = await resolveAutomacaoTenantForPublicTenant(publicTenantUuid, client);
  if (!automacaoTenantId) {
    return { kind: "tenant_not_linked" };
  }

  return applyFiscalGuiaReconciliation(client, automacaoTenantId, strict.value);
}
