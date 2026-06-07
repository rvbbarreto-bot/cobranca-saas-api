import type { PoolClient } from "pg";
import { isFiscalGuiasEnabled } from "../../../platform/config/fiscal-guias-enabled";
import type { FiscalCaptureJobPayload } from "../../../platform/jobs/application/fiscal-capture-processor";
import {
  parseFiscalCaptureInboxPayload,
  type FiscalCaptureInboxPayload
} from "../domain/schemas/fiscal-capture-inbox.schema";
import { resolveFiscalClienteForPublicTenant } from "./resolve-fiscal-cliente-for-public-tenant";

export type FiscalInboxHandleResult =
  | { kind: "not_fiscal" }
  | { kind: "disabled" }
  | { kind: "invalid"; issues: string[] }
  | { kind: "cliente_not_found" }
  | { kind: "queued"; job: FiscalCaptureJobPayload };

export function tryParseFiscalCaptureInboxPayload(
  payload: unknown
): FiscalCaptureInboxPayload | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const eventType = (payload as { event_type?: unknown }).event_type;
  if (eventType !== "fiscal.capture.requested") {
    return null;
  }
  const parsed = parseFiscalCaptureInboxPayload(payload);
  if (!parsed.ok) {
    return null;
  }
  return parsed.value;
}

export async function handleFiscalCaptureInboxPayload(
  publicTenantUuid: string,
  payload: unknown,
  client: PoolClient
): Promise<FiscalInboxHandleResult> {
  const fiscalPayload = tryParseFiscalCaptureInboxPayload(payload);
  if (!fiscalPayload) {
    return { kind: "not_fiscal" };
  }

  if (!isFiscalGuiasEnabled()) {
    return { kind: "disabled" };
  }

  const strict = parseFiscalCaptureInboxPayload(payload);
  if (!strict.ok) {
    return {
      kind: "invalid",
      issues: strict.issues.map((i) => `${i.path.join(".")}: ${i.message}`)
    };
  }

  const resolved = await resolveFiscalClienteForPublicTenant(
    publicTenantUuid,
    strict.value.portal_cliente_id,
    client
  );
  if (!resolved) {
    return { kind: "cliente_not_found" };
  }

  return {
    kind: "queued",
    job: {
      publicTenantUuid,
      automacaoTenantId: resolved.automacaoTenantId,
      portalClienteId: resolved.portalClienteId,
      tipoGuia: strict.value.tipo_guia,
      competencia: strict.value.competencia,
      idempotencyKey: strict.value.idempotency_key,
      codigoReceita: strict.value.codigo_receita,
      periodoApuracao: strict.value.periodo_apuracao,
      correlationId: strict.value.correlation_id,
      n8nExecutionId: strict.value.n8n_execution_id
    }
  };
}
