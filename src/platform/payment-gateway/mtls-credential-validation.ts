import tls from "node:tls";

export type MtlsPemValidationResult = { ok: true } | { ok: false; message: string };

const PEM_BLOCK_RE = /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g;

/** Remove lixo comum de copy/paste (prompt do terminal, linhas antes/depois do bloco PEM). */
export function sanitizePemPaste(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.match(PEM_BLOCK_RE);
  if (blocks?.length) {
    return blocks.map((block) => block.trim()).join("\n");
  }
  return normalized.trim();
}

function normalizePem(pem: string): string {
  return sanitizePemPaste(pem);
}

function friendlyTlsError(message: string): string {
  if (/bad end line|04800066|PEM routines/i.test(message)) {
    return (
      "Certificado ou chave PEM com formato invalido. Cole apenas o bloco completo " +
      "(de -----BEGIN ...----- ate -----END ...-----), sem linhas do terminal ou pastas."
    );
  }
  if (/key values mismatch|certificate.*key/i.test(message)) {
    return "Certificado e chave privada nao correspondem ao mesmo par. Verifique os arquivos do banco.";
  }
  return `Par certificado/chave invalido: ${message.split("\n")[0]}`;
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
      message: friendlyTlsError(message)
    };
  }
}
