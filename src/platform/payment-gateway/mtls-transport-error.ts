export type MtlsTransportErrorCode = "mtls_handshake_failed" | "mtls_network_error";

/** Erro de transporte TLS/rede em chamadas mTLS (antes de HTTP status). */
export class MtlsTransportError extends Error {
  readonly code: MtlsTransportErrorCode;
  readonly retryable = false;

  constructor(message: string, code: MtlsTransportErrorCode, cause?: unknown) {
    super(message, { cause });
    this.name = "MtlsTransportError";
    this.code = code;
  }
}

const UNKNOWN_CA_RE = /unknown ca|alert number 48/i;
const PEM_TLS_RE = /bad certificate|certificate verify failed|key values mismatch|tlsv1 alert/i;
const NETWORK_RE = /getaddrinfo|eai_again|enotfound|etimedout|econnrefused|econnreset|enetunreach/i;

export function classifyMtlsTransportError(err: unknown): MtlsTransportError {
  const raw = err instanceof Error ? err.message : String(err);
  const cause = err instanceof Error ? err : undefined;

  if (UNKNOWN_CA_RE.test(raw)) {
    return new MtlsTransportError(
      "Certificado mTLS rejeitado pelo servidor (unknown_ca). " +
        "Use client_id, client_secret, certificado PEM e chave privada da mesma aplicacao no Portal Developers Inter.",
      "mtls_handshake_failed",
      cause
    );
  }

  if (PEM_TLS_RE.test(raw)) {
    return new MtlsTransportError(
      `Falha TLS no handshake mTLS: ${raw.split("\n")[0]}`,
      "mtls_handshake_failed",
      cause
    );
  }

  if (NETWORK_RE.test(raw)) {
    return new MtlsTransportError(
      `Falha de rede ao conectar ao gateway mTLS: ${raw.split("\n")[0]}`,
      "mtls_network_error",
      cause
    );
  }

  return new MtlsTransportError(
    `Falha de transporte mTLS: ${raw.split("\n")[0]}`,
    "mtls_network_error",
    cause
  );
}

export function isMtlsTransportError(err: unknown): err is MtlsTransportError {
  return err instanceof MtlsTransportError;
}
