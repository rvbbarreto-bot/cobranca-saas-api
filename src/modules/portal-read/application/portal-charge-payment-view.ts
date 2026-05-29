import type { ChargePaymentView } from "../../billing-core/domain/charge";
import {
  isInterPdfPlaceholder,
  portalBoletoPdfApiPath
} from "../../payment-gateway/infrastructure/inter/inter-pdf-url";

/** Expõe URL de PDF utilizável no portal (proxy autenticado para Inter). */
export function mapChargePaymentForPortal(
  payment: ChargePaymentView | null,
  chargeId: string
): ChargePaymentView | null {
  if (!payment) {
    return null;
  }
  const pdfProxy =
    isInterPdfPlaceholder(payment.boleto_pdf_url) || isInterPdfPlaceholder(payment.boleto_url);
  if (!pdfProxy) {
    const { gateway: _g, gateway_transaction_id: _t, ...rest } = payment;
    return rest;
  }
  const proxyPath = portalBoletoPdfApiPath(chargeId);
  const { gateway: _g, gateway_transaction_id: _t, ...rest } = payment;
  return {
    ...rest,
    boleto_pdf_url: proxyPath,
    boleto_url: isInterPdfPlaceholder(payment.boleto_url) ? proxyPath : payment.boleto_url
  };
}
