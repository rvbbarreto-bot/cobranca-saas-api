import { pemFailure, type PemValidationResult } from "./pem-error-catalog.js";
import {
  ALLOWED_PEM_EXTENSIONS,
  decodePemBody,
  extractPemBlocks,
  isCertificateBlockType,
  isPrivateKeyBlockType,
  PEM_MAX_BYTES,
  readUploadAsUtf8
} from "./pem-parse-utils.js";

export type PemFieldKind = "certificate" | "private_key";

export function validateAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) {
    return false;
  }
  return ALLOWED_PEM_EXTENSIONS.has(lower.slice(dot));
}

/** RV-01 a RV-04 — validação local (frontend espelha esta lógica). */
export function validatePemFileLocal(
  buffer: Buffer,
  filename: string,
  field: PemFieldKind
): PemValidationResult {
  if (!validateAllowedExtension(filename)) {
    return pemFailure("ERR-001", {}, field);
  }

  if (buffer.byteLength === 0 || buffer.byteLength > PEM_MAX_BYTES) {
    return pemFailure("ERR-004", {}, field);
  }

  const raw = readUploadAsUtf8(buffer);
  const blocks = extractPemBlocks(raw);
  if (blocks.length === 0) {
    return pemFailure("ERR-001", {}, field);
  }

  if (field === "certificate") {
    const certBlocks = blocks.filter((b) => isCertificateBlockType(b.type));
    if (certBlocks.length === 0) {
      return pemFailure("ERR-002", {}, field);
    }
    if (certBlocks.length > 1 || blocks.some((b) => isPrivateKeyBlockType(b.type))) {
      return pemFailure(
        "ERR-002",
        {},
        field
      );
    }
    const der = decodePemBody(certBlocks[0]!.pem);
    if (!der) {
      return pemFailure("ERR-003", {}, field);
    }
    return { ok: true, warnings: [] };
  }

  const keyBlocks = blocks.filter((b) => isPrivateKeyBlockType(b.type));
  if (keyBlocks.length === 0) {
    return pemFailure("ERR-002", {}, field);
  }
  if (keyBlocks.some((b) => b.type === "ENCRYPTED PRIVATE KEY")) {
    return pemFailure("ERR-002", {}, field);
  }
  if (blocks.some((b) => isCertificateBlockType(b.type))) {
    return pemFailure("ERR-002", {}, field);
  }
  const der = decodePemBody(keyBlocks[0]!.pem);
  if (!der) {
    return pemFailure("ERR-003", {}, field);
  }
  return { ok: true, warnings: [] };
}

export function extractSinglePemForField(buffer: Buffer, field: PemFieldKind): string | null {
  const raw = readUploadAsUtf8(buffer);
  const blocks = extractPemBlocks(raw);
  if (field === "certificate") {
    const cert = blocks.find((b) => isCertificateBlockType(b.type));
    return cert?.pem ?? null;
  }
  const key = blocks.find((b) => isPrivateKeyBlockType(b.type) && b.type !== "ENCRYPTED PRIVATE KEY");
  return key?.pem ?? null;
}
