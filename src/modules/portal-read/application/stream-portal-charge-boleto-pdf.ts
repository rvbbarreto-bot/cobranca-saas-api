import type { PoolClient } from "pg";
import { getChargeWithLatestPayment } from "../../billing-core/infrastructure/charge-repository";
import { getGatewayForTenant } from "../../payment-gateway/application/get-gateway-for-tenant";
import { InterAdapter } from "../../payment-gateway/infrastructure/inter/inter-adapter";
import {
  isInterPdfPlaceholder,
  parseInterPdfCodigoSolicitacao
} from "../../payment-gateway/infrastructure/inter/inter-pdf-url";

export type StreamPortalChargeBoletoPdfResult =
  | { ok: true; buffer: Buffer; filename: string }
  | { ok: false; reason: "not_found" | "no_payment" | "not_inter" | "no_codigo" };

export async function streamPortalChargeBoletoPdfUseCase(
  client: PoolClient,
  chargeId: string,
  tenantId: string
): Promise<StreamPortalChargeBoletoPdfResult> {
  const base = await getChargeWithLatestPayment(client, chargeId, tenantId);
  if (!base) {
    return { ok: false, reason: "not_found" };
  }

  const payment = base.payment;
  if (!payment?.gateway_transaction_id) {
    return { ok: false, reason: "no_payment" };
  }

  if (payment.gateway?.toLowerCase() !== "inter") {
    return { ok: false, reason: "not_inter" };
  }

  const codigo =
    parseInterPdfCodigoSolicitacao(payment.boleto_pdf_url ?? "") ||
    parseInterPdfCodigoSolicitacao(payment.boleto_url ?? "") ||
    payment.gateway_transaction_id.trim();

  if (!codigo) {
    return { ok: false, reason: "no_codigo" };
  }

  const gateway = await getGatewayForTenant(client, tenantId);
  if (!(gateway instanceof InterAdapter)) {
    return { ok: false, reason: "not_inter" };
  }

  const buffer = await gateway.downloadBoletoPdf(codigo);
  const filename = `boleto-${base.charge.reference.replace(/[^\w.-]+/g, "_").slice(0, 80) || chargeId}.pdf`;
  return { ok: true, buffer, filename };
}

export function chargeHasInterPdfProxy(payment: {
  boleto_pdf_url: string | null;
  boleto_url: string | null;
} | null): boolean {
  if (!payment) {
    return false;
  }
  return isInterPdfPlaceholder(payment.boleto_pdf_url) || isInterPdfPlaceholder(payment.boleto_url);
}
