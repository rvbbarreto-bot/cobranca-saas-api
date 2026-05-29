import { mapInterChargeStatus } from "../../payment-gateway/domain/gateway-status-map";
import type { WebhookChargeInstruction } from "./parse-webhook-charge-payload";

export function isLikelyInterWebhook(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const p = payload as Record<string, unknown>;
  const inner =
    p.payload && typeof p.payload === "object" ? (p.payload as Record<string, unknown>) : p;
  return (
    typeof inner.codigoSolicitacao === "string" &&
    inner.codigoSolicitacao.trim().length > 0 &&
    typeof inner.situacao === "string" &&
    inner.situacao.trim().length > 0
  );
}

function unwrapInterPayload(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const p = payload as Record<string, unknown>;
  if (p.payload && typeof p.payload === "object") {
    return p.payload as Record<string, unknown>;
  }
  return p;
}

export function parseInterWebhook(
  payload: unknown
): { ok: true; value: WebhookChargeInstruction } | { ok: false; issues: string[] } {
  const body = unwrapInterPayload(payload);
  if (!body) {
    return { ok: false, issues: ["payload: invalido"] };
  }

  const codigo =
    typeof body.codigoSolicitacao === "string" ? body.codigoSolicitacao.trim() : "";
  const situacao = typeof body.situacao === "string" ? body.situacao.trim() : "";
  const seuNumero = typeof body.seuNumero === "string" ? body.seuNumero.trim() : "";

  if (!codigo) {
    return { ok: false, issues: ["codigoSolicitacao: obrigatorio"] };
  }
  if (!situacao) {
    return { ok: false, issues: ["situacao: obrigatorio"] };
  }

  const canonicalStatus = mapInterChargeStatus(situacao);
  if (!canonicalStatus) {
    return { ok: false, issues: [`situacao: nao mapeada (${situacao})`] };
  }

  return {
    ok: true,
    value: {
      canonicalStatus,
      providerChargeId: codigo,
      reference: seuNumero || undefined
    }
  };
}
