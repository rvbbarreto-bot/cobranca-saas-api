import { decryptAes256Gcm, encryptAes256Gcm } from "../../../platform/crypto/symmetric-encryption";

const BUNDLE_MARKER = "__bundled__";

export type DecryptedCertificadoPem = {
  certificadoPem: string;
  chavePrivadaPem: string;
};

export function encryptCertificadoBundle(
  certificadoPem: string,
  chavePrivadaPem: string
): {
  cert_encrypted: string;
  key_encrypted: string;
  encryption_iv: string;
} {
  const payload = JSON.stringify({ cert: certificadoPem, key: chavePrivadaPem });
  const { ciphertext, iv } = encryptAes256Gcm(payload);
  return {
    cert_encrypted: ciphertext,
    key_encrypted: BUNDLE_MARKER,
    encryption_iv: iv
  };
}

export function decryptCertificadoBundle(
  certEncrypted: string,
  keyEncrypted: string,
  iv: string
): DecryptedCertificadoPem {
  if (keyEncrypted === BUNDLE_MARKER) {
    const json = decryptAes256Gcm(certEncrypted, iv);
    const parsed = JSON.parse(json) as { cert?: string; key?: string };
    if (!parsed.cert?.trim() || !parsed.key?.trim()) {
      throw new Error("Bundle certificado invalido.");
    }
    return { certificadoPem: parsed.cert, chavePrivadaPem: parsed.key };
  }
  return {
    certificadoPem: decryptAes256Gcm(certEncrypted, iv),
    chavePrivadaPem: decryptAes256Gcm(keyEncrypted, iv)
  };
}

export function computeCertificateVaultStatus(
  validUntil: string,
  asOf: Date = new Date()
): "active" | "expiring" | "expired" {
  const end = new Date(`${validUntil}T23:59:59`);
  if (Number.isNaN(end.getTime()) || end < asOf) {
    return "expired";
  }
  const daysLeft = Math.ceil((end.getTime() - asOf.getTime()) / (24 * 60 * 60 * 1000));
  return daysLeft <= 30 ? "expiring" : "active";
}
