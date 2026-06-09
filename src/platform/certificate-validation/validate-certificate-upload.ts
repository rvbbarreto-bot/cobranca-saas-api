import {
  extractSinglePemForField,
  validatePemFileLocal
} from "./pem-local-validation.js";
import {
  buildIntegrationPayload,
  buildSuccessMessages,
  validatePemPairDeep,
  type CertificateIntegrationPayload
} from "./pem-deep-validation.js";
import { pemFailure, type PemErrorCode } from "./pem-error-catalog.js";
import type { PemValidationFailure } from "./pem-error-catalog.js";
import { saveCertificateUpload } from "./certificate-upload-store.js";

const VALIDATION_TIMEOUT_MS = 10_000;

export type CertificateValidateSuccess = {
  certificate_id: string;
  subject_cn: string;
  not_after: string;
  days_remaining: number;
  warnings: PemErrorCode[];
  info: string[];
};

export type CertificateValidateFailure = PemValidationFailure;

function daysRemaining(notAfterIso: string, now: Date): number {
  const end = new Date(notAfterIso);
  return Math.floor((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}

async function withTimeout<T>(fn: () => T, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(fn),
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("TIMEOUT")), ms);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

type ValidatedPair = {
  payload: CertificateIntegrationPayload;
  warnings: PemErrorCode[];
};

function validatePairInProcess(input: {
  certificateBuffer: Buffer;
  certificateFilename: string;
  privateKeyBuffer: Buffer;
  privateKeyFilename: string;
  now: Date;
}): ValidatedPair | CertificateValidateFailure {
  const certLocal = validatePemFileLocal(
    input.certificateBuffer,
    input.certificateFilename,
    "certificate"
  );
  if (!certLocal.ok) {
    return certLocal;
  }

  const keyLocal = validatePemFileLocal(
    input.privateKeyBuffer,
    input.privateKeyFilename,
    "private_key"
  );
  if (!keyLocal.ok) {
    return keyLocal;
  }

  const certificatePem = extractSinglePemForField(input.certificateBuffer, "certificate");
  const privateKeyPem = extractSinglePemForField(input.privateKeyBuffer, "private_key");
  if (!certificatePem || !privateKeyPem) {
    return pemFailure("ERR-009", {}, "certificate");
  }

  const deep = validatePemPairDeep(certificatePem, privateKeyPem, input.now);
  if (!deep.ok) {
    return deep;
  }

  const payload = buildIntegrationPayload("pending", certificatePem, privateKeyPem, input.now);
  if (!payload) {
    return pemFailure("ERR-009", {}, "certificate");
  }

  return { payload, warnings: deep.warnings };
}

export async function validateAndStoreCertificateUpload(input: {
  tenantId: string;
  userId: string;
  certificateBuffer: Buffer;
  certificateFilename: string;
  privateKeyBuffer: Buffer;
  privateKeyFilename: string;
  now?: Date;
}): Promise<CertificateValidateSuccess | CertificateValidateFailure> {
  const now = input.now ?? new Date();

  let validated: ValidatedPair | CertificateValidateFailure;
  try {
    validated = await withTimeout(
      () =>
        validatePairInProcess({
          certificateBuffer: input.certificateBuffer,
          certificateFilename: input.certificateFilename,
          privateKeyBuffer: input.privateKeyBuffer,
          privateKeyFilename: input.privateKeyFilename,
          now
        }),
      VALIDATION_TIMEOUT_MS
    );
  } catch (err) {
    if (err instanceof Error && err.message === "TIMEOUT") {
      return pemFailure("NET-001");
    }
    return pemFailure("NET-001");
  }

  if ("error_code" in validated) {
    return validated;
  }

  const certificateId = await saveCertificateUpload(
    input.tenantId,
    input.userId,
    validated.payload
  );
  const stored = { ...validated.payload, certificate_id: certificateId };
  const messages = buildSuccessMessages(
    stored,
    validated.warnings.filter((w) => w === "WARN-001") as ("WARN-001")[],
    now
  );

  return {
    certificate_id: certificateId,
    subject_cn: stored.subject_cn,
    not_after: stored.not_after,
    days_remaining: daysRemaining(stored.not_after, now),
    warnings: validated.warnings.filter((w) => w === "WARN-001"),
    info: [...messages.info, ...messages.warnings]
  };
}
