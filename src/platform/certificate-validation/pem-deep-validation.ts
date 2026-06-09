import { createHash, X509Certificate } from "node:crypto";
import tls from "node:tls";
import { pemFailure, type PemValidationResult } from "./pem-error-catalog.js";
import { decodePemBody } from "./pem-parse-utils.js";
import { validateMtlsPemPair } from "../payment-gateway/mtls-credential-validation.js";

const UNSUPPORTED_SIG = /\b(sha1|md5)\b/i;

function formatIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function parseX509(certPem: string): X509Certificate | null {
  try {
    return new X509Certificate(certPem);
  } catch {
    return null;
  }
}

function extractCn(subject: string): string {
  return subject.split("\n").find((l) => l.startsWith("CN="))?.slice(3)?.trim() ?? "";
}

function extractIssuerCn(issuer: string): string {
  return issuer.split("\n").find((l) => l.startsWith("CN="))?.slice(3)?.trim() ?? issuer;
}

function fingerprintHex(cert: X509Certificate, algo: "sha1" | "sha256"): string {
  const hash = createHash(algo).update(cert.raw).digest("hex").toUpperCase();
  return hash.match(/.{1,2}/g)?.join(":") ?? hash;
}

function certSignatureLabel(cert: X509Certificate): string {
  try {
    const legacy = cert.toLegacyObject() as { sigalg?: string };
    return legacy.sigalg ?? "";
  } catch {
    return "";
  }
}

function validateSignatureAlgorithm(cert: X509Certificate): PemValidationResult | null {
  const sig = certSignatureLabel(cert);
  if (sig && UNSUPPORTED_SIG.test(sig)) {
    return pemFailure("ERR-008", { alg: sig }, "certificate");
  }
  const keyDetails = cert.publicKey.asymmetricKeyDetails;
  if (keyDetails?.modulusLength !== undefined && keyDetails.modulusLength < 2048) {
    return pemFailure("ERR-008", { alg: `RSA ${keyDetails.modulusLength}` }, "certificate");
  }
  return null;
}

function validateValidityWindow(cert: X509Certificate, now: Date): {
  error: PemValidationResult | null;
  warnings: ("WARN-001")[];
} {
  const notBefore = new Date(cert.validFrom);
  const notAfter = new Date(cert.validTo);
  const warnings: ("WARN-001")[] = [];

  if (notAfter.getTime() < now.getTime()) {
    return {
      error: pemFailure("ERR-005", { data: formatIsoDate(notAfter) }, "certificate"),
      warnings
    };
  }
  if (notBefore.getTime() > now.getTime()) {
    return {
      error: pemFailure("ERR-006", { data: formatIsoDate(notBefore) }, "certificate"),
      warnings
    };
  }
  const remaining = daysBetween(now, notAfter);
  if (remaining < 30) {
    warnings.push("WARN-001");
  }
  return { error: null, warnings };
}

/** RV-05 a RV-08 — validação profunda no backend. */
export function validatePemPairDeep(
  certificatePem: string,
  privateKeyPem: string,
  now: Date = new Date()
): PemValidationResult {
  const cert = parseX509(certificatePem);
  if (!cert) {
    return pemFailure("ERR-009", {}, "certificate");
  }

  const certDer = decodePemBody(certificatePem);
  const keyDer = decodePemBody(privateKeyPem);
  if (!certDer || !keyDer) {
    return pemFailure("ERR-009", {}, "certificate");
  }

  const sigCheck = validateSignatureAlgorithm(cert);
  if (sigCheck) {
    return sigCheck;
  }

  const validity = validateValidityWindow(cert, now);
  if (validity.error) {
    return validity.error;
  }

  const pairCheck = validateMtlsPemPair(certificatePem, privateKeyPem);
  if (!pairCheck.ok) {
    return pemFailure("ERR-007", {}, "private_key");
  }

  try {
    tls.createSecureContext({ cert: certificatePem, key: privateKeyPem });
  } catch {
    return pemFailure("ERR-007", {}, "private_key");
  }

  return { ok: true, warnings: validity.warnings };
}

export type CertificateIntegrationPayload = {
  certificate_id: string;
  certificate_der: string;
  private_key_der: string;
  subject_cn: string;
  issuer_cn: string;
  serial: string;
  not_before: string;
  not_after: string;
  key_algorithm: string;
  key_size: number;
  signature_alg: string;
  fingerprint_sha1: string;
  fingerprint_sha256: string;
  created_at: string;
  certificate_pem: string;
  private_key_pem: string;
};

export function buildIntegrationPayload(
  certificateId: string,
  certificatePem: string,
  privateKeyPem: string,
  createdAt: Date = new Date()
): CertificateIntegrationPayload | null {
  const cert = parseX509(certificatePem);
  if (!cert) {
    return null;
  }
  const certDer = decodePemBody(certificatePem);
  const keyDer = decodePemBody(privateKeyPem);
  if (!certDer || !keyDer) {
    return null;
  }

  const keyDetails = cert.publicKey.asymmetricKeyDetails;
  const keySize = keyDetails?.modulusLength ?? (cert.publicKey.asymmetricKeyType === "ec" ? 256 : 0);

  return {
    certificate_id: certificateId,
    certificate_der: certDer.toString("base64"),
    private_key_der: keyDer.toString("base64"),
    subject_cn: extractCn(cert.subject),
    issuer_cn: extractIssuerCn(cert.issuer),
    serial: cert.serialNumber,
    not_before: new Date(cert.validFrom).toISOString(),
    not_after: new Date(cert.validTo).toISOString(),
    key_algorithm: cert.publicKey.asymmetricKeyType?.toUpperCase() ?? "RSA",
    key_size: keySize,
    signature_alg: certSignatureLabel(cert) || "SHA256withRSA",
    fingerprint_sha1: fingerprintHex(cert, "sha1"),
    fingerprint_sha256: fingerprintHex(cert, "sha256"),
    created_at: createdAt.toISOString(),
    certificate_pem: certificatePem,
    private_key_pem: privateKeyPem
  };
}

export function buildSuccessMessages(
  payload: CertificateIntegrationPayload,
  warnings: ("WARN-001")[],
  now: Date = new Date()
): { info: string[]; warnings: string[] } {
  const notAfter = new Date(payload.not_after);
  const remaining = daysBetween(now, notAfter);
  const info = [
    `Certificado válido. Expira em ${formatIsoDate(notAfter)} · CN: ${payload.subject_cn} · Emitido por: ${payload.issuer_cn}.`,
    "Par certificado/chave validado com sucesso."
  ];
  const warnMsgs =
    warnings.includes("WARN-001")
      ? [
          `O certificado expira em ${remaining} dias (${formatIsoDate(notAfter)}). Recomendamos renová-lo em breve.`
        ]
      : [];
  return { info, warnings: warnMsgs };
}
