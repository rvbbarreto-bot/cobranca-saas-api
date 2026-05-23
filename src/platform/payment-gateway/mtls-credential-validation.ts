import tls from "node:tls";

export type MtlsPemValidationResult = { ok: true } | { ok: false; message: string };

function normalizePem(pem: string): string {
  return pem.replace(/\r\n/g, "\n").trim();
}

function assertPemMarkers(certPem: string, keyPem: string): MtlsPemValidationResult | null {
  const cert = normalizePem(certPem);
  const key = normalizePem(keyPem);
  if (!cert.includes("BEGIN CERTIFICATE")) {
    return { ok: false, message: "Certificado deve estar em PEM (BEGIN CERTIFICATE)." };
  }
  if (!key.includes("BEGIN") || (!key.includes("PRIVATE KEY") && !key.includes("RSA PRIVATE KEY"))) {
    return { ok: false, message: "Chave privada deve estar em PEM (BEGIN ... PRIVATE KEY)." };
  }
  return null;
}

/** Valida par cert+chave antes de persistir credenciais mTLS (Inter, Cora, C6). */
export function validateMtlsPemPair(certPem: string, keyPem: string): MtlsPemValidationResult {
  const markerError = assertPemMarkers(certPem, keyPem);
  if (markerError) {
    return markerError;
  }

  const cert = normalizePem(certPem);
  const key = normalizePem(keyPem);

  try {
    tls.createSecureContext({ cert, key });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      message: `Par certificado/chave invalido: ${message.split("\n")[0]}`
    };
  }
}
