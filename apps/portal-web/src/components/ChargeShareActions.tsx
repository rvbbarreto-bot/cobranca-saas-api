import type { PortalChargePayment } from "../lib/api";
import { isUsableHttpUrl } from "../lib/charge-payment-ui";
import {
  buildChargeWhatsAppMessage,
  buildWhatsAppShareUrl,
  normalizeBrWhatsAppPhone
} from "../lib/whatsapp-share";

type Props = {
  clienteNome: string;
  clienteTelefone: string | null | undefined;
  clienteEmail: string | null | undefined;
  whatsappOptIn?: boolean;
  amountLabel: string;
  dueLabel: string;
  payment: PortalChargePayment | null;
};

export function ChargeShareActions({
  clienteNome,
  clienteTelefone,
  clienteEmail,
  whatsappOptIn = false,
  amountLabel,
  dueLabel,
  payment
}: Props): JSX.Element {
  const phone = normalizeBrWhatsAppPhone(clienteTelefone);
  const boletoUrl = isUsableHttpUrl(payment?.boleto_url) ? payment!.boleto_url! : null;
  const pdfUrl = isUsableHttpUrl(payment?.boleto_pdf_url) ? payment!.boleto_pdf_url! : null;
  const pixEmv = payment?.pix_emv?.trim() || null;

  const message = buildChargeWhatsAppMessage({
    clienteNome,
    amountLabel,
    dueLabel,
    boletoUrl,
    pdfUrl,
    pixEmv
  });

  const whatsappHref =
    phone && whatsappOptIn ? buildWhatsAppShareUrl(phone, message) : null;
  const mailtoHref =
    clienteEmail?.trim() && (boletoUrl || pdfUrl || pixEmv)
      ? `mailto:${encodeURIComponent(clienteEmail.trim())}?subject=${encodeURIComponent(
          `Cobrança — ${clienteNome}`
        )}&body=${encodeURIComponent(message)}`
      : null;

  return (
    <div id="enviar" className="charge-share-actions" style={{ marginTop: "1rem" }}>
      <p className="payment-panel__title" style={{ marginBottom: "0.5rem" }}>
        Enviar ao cliente
      </p>
      <div className="form-actions" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
        {whatsappHref ? (
          <a href={whatsappHref} target="_blank" rel="noreferrer" className="btn-cyan">
            WhatsApp
          </a>
        ) : (
          <span
            className="muted small"
            title={
              !phone
                ? "Cadastre telefone do cliente com DDD"
                : "Ative WhatsApp no cadastro do cliente"
            }
          >
            {!phone
              ? "WhatsApp indisponível (telefone do cliente ausente ou inválido)."
              : "WhatsApp indisponível (cliente sem opt-in de WhatsApp)."}
          </span>
        )}
        {mailtoHref ? (
          <a href={mailtoHref} className="btn-secondary">
            E-mail (rascunho)
          </a>
        ) : null}
      </div>
      {!payment ? (
        <p className="muted small" style={{ marginTop: "0.5rem" }}>
          Aguarde a emissão do boleto/PIX para incluir links na mensagem.
        </p>
      ) : null}
    </div>
  );
}
