import { useState } from "react";
import type { PortalChargePayment } from "../lib/api";
import { fetchPortalChargeBoletoPdfBlob } from "../lib/api";
import { isUsableHttpUrl, openPortalChargeBoletoPdf } from "../lib/charge-payment-ui";

function pixQrSrc(base64: string): string {
  const raw = base64.trim();
  if (raw.startsWith("data:")) {
    return raw;
  }
  return `data:image/png;base64,${raw}`;
}

type Props = {
  payment: PortalChargePayment | null;
  chargeStatus: string;
  chargeType?: "boleto" | "pix";
  /** Quando false (ex.: Banco Inter), oculta bloco PIX mesmo que existam campos residuais. */
  showPixQr?: boolean;
};

export function ChargePaymentPanel({
  payment,
  chargeStatus,
  chargeType,
  showPixQr = true
}: Props): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const awaitingEmission =
    !payment &&
    chargeStatus !== "cancelada" &&
    chargeStatus !== "erro_emissao" &&
    (chargeStatus === "rascunho" || chargeStatus === "emitida");

  if (awaitingEmission) {
    return (
      <div className="payment-panel payment-panel--pending">
        <p className="payment-panel__title">Emissão em andamento</p>
        <p className="muted small">
          A cobrança foi registrada e o gateway está gerando{" "}
          {chargeType === "pix" ? "o PIX" : "o boleto"}. Esta página atualiza automaticamente.
        </p>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="payment-panel payment-panel--empty">
        <p className="muted small">Pagamento ainda não disponível para este título.</p>
      </div>
    );
  }

  async function copyPix(): Promise<void> {
    if (!payment?.pix_emv) {
      return;
    }
    try {
      await navigator.clipboard.writeText(payment.pix_emv);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  if (payment.type === "pix") {
    return (
      <div className="payment-panel">
        <p className="payment-panel__title">PIX</p>
        {payment.pix_qrcode_base64 ? (
          <img
            className="payment-panel__qr"
            src={pixQrSrc(payment.pix_qrcode_base64)}
            alt="QR Code PIX"
            width={220}
            height={220}
          />
        ) : null}
        {payment.pix_emv ? (
          <div className="payment-panel__copy">
            <code className="payment-panel__emv">{payment.pix_emv}</code>
            <button
              type="button"
              className="btn-cyan"
              aria-label={copied ? "Código PIX copiado" : "Copiar código PIX copia e cola"}
              onClick={() => void copyPix()}
            >
              {copied ? "Copiado" : "Copiar PIX copia e cola"}
            </button>
          </div>
        ) : null}
        {payment.pix_link ? (
          <p className="small">
            <a href={payment.pix_link} target="_blank" rel="noreferrer" className="link-inline">
              Abrir link de pagamento PIX
            </a>
          </p>
        ) : null}
        {payment.expires_at ? (
          <p className="muted small">Validade: {new Date(payment.expires_at).toLocaleString("pt-BR")}</p>
        ) : null}
      </div>
    );
  }

  const hasPix =
    showPixQr &&
    Boolean(payment.pix_qrcode_base64?.trim() || payment.pix_emv?.trim() || payment.pix_link?.trim());

  const boletoUrl = isUsableHttpUrl(payment.boleto_url) ? payment.boleto_url : null;
  const pdfUrl = isUsableHttpUrl(payment.boleto_pdf_url) ? payment.boleto_pdf_url : null;
  const pdfIsPortalProxy = Boolean(pdfUrl?.includes("/boleto.pdf"));

  return (
    <div id="pagamento" className="payment-panel">
      <p className="payment-panel__title">Boleto</p>
      {payment.boleto_barcode ? (
        <p className="small" style={{ wordBreak: "break-all", fontVariantNumeric: "tabular-nums" }}>
          Linha digitável: {payment.boleto_barcode}
        </p>
      ) : null}
      <div className="form-actions" style={{ marginTop: "0.75rem", flexWrap: "wrap" }}>
        {boletoUrl && !pdfIsPortalProxy ? (
          <a href={boletoUrl} target="_blank" rel="noreferrer" className="btn-cyan">
            Abrir boleto
          </a>
        ) : null}
        {pdfUrl && pdfIsPortalProxy ? (
          <button
            type="button"
            className="btn-secondary"
            aria-label="Abrir PDF do boleto"
            onClick={() => {
              setPdfError(null);
              void openPortalChargeBoletoPdf(pdfUrl, fetchPortalChargeBoletoPdfBlob).catch((err: unknown) => {
                const msg =
                  err instanceof Error && err.message.trim()
                    ? err.message
                    : "Não foi possível abrir o PDF do boleto. Tente novamente ou contate o suporte.";
                setPdfError(msg);
              });
            }}
          >
            PDF do boleto
          </button>
        ) : null}
        {pdfUrl && !pdfIsPortalProxy ? (
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="btn-secondary">
            PDF do boleto
          </a>
        ) : null}
      </div>
      {payment.expires_at ? (
        <p className="muted small">Validade: {new Date(payment.expires_at).toLocaleString("pt-BR")}</p>
      ) : null}
      {pdfError ? (
        <p className="small" role="alert" style={{ color: "var(--color-error)", marginTop: "0.5rem" }}>
          {pdfError}
        </p>
      ) : null}
      {hasPix ? (
        <div className="payment-panel__pix-block" style={{ marginTop: "1rem" }}>
          <p className="payment-panel__title">PIX (QR integrado)</p>
          {payment.pix_qrcode_base64 ? (
            <img
              className="payment-panel__qr"
              src={pixQrSrc(payment.pix_qrcode_base64)}
              alt="QR Code PIX"
              width={180}
              height={180}
            />
          ) : null}
          {payment.pix_emv ? (
            <div className="payment-panel__copy">
              <code className="payment-panel__emv">{payment.pix_emv}</code>
              <button
                type="button"
                className="btn-cyan"
                aria-label={copied ? "Código PIX copiado" : "Copiar código PIX copia e cola"}
                onClick={() => void copyPix()}
              >
                {copied ? "Copiado" : "Copiar PIX copia e cola"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
