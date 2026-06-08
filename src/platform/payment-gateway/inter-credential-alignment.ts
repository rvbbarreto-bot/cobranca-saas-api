import { X509Certificate } from "node:crypto";
import { sanitizePemPaste } from "./mtls-credential-validation";

const INTER_INTEGRATION_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Inter grava o ID da aplicacao (integracao) no campo OU do certificado mTLS.
 * Deve ser identico ao client_id usado no OAuth (Portal Developers).
 * @see https://developers.inter.co/
 */
export function extractIntegrationIdFromInterCert(certPem: string): string | null {
  try {
    const cert = new X509Certificate(sanitizePemPaste(certPem));
    const ou = cert.subject
      .split("\n")
      .find((line) => line.startsWith("OU="))
      ?.slice(3)
      ?.trim();
    if (ou && INTER_INTEGRATION_UUID_RE.test(ou)) {
      return ou.toLowerCase();
    }
  } catch {
    return null;
  }
  return null;
}

export type InterCredentialAlignmentResult = { ok: true } | { ok: false; message: string };

export function validateInterCredentialAppAlignment(
  clientId: string,
  certificatePem: string
): InterCredentialAlignmentResult {
  const normalizedClientId = clientId.trim().toLowerCase();
  if (!INTER_INTEGRATION_UUID_RE.test(normalizedClientId)) {
    return {
      ok: false,
      message:
        "client_id do Banco Inter deve ser o UUID da aplicacao exibido no Portal Developers (https://developers.inter.co/)."
    };
  }

  const integrationId = extractIntegrationIdFromInterCert(certificatePem);
  if (!integrationId) {
    // Certificados de teste/local sem OU de integracao: demais validacoes PEM + OAuth no Inter.
    return { ok: true };
  }

  if (integrationId !== normalizedClientId) {
    return {
      ok: false,
      message:
        `Certificado emitido para a integracao ${integrationId}, mas o client_id informado e ${normalizedClientId}. ` +
        "Grave client_id, client_secret, certificado PEM e chave privada PEM da mesma aplicacao no Portal Developers Inter."
    };
  }

  return { ok: true };
}
