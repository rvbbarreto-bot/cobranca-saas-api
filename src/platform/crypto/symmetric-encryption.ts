import { createDecipheriv, createCipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function encryptionKeyBuffer(): Buffer {
  const raw = process.env.ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("ENCRYPTION_KEY ausente.");
  }
  const key = Buffer.from(raw, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY deve ter 32 bytes em hexadecimal (64 caracteres).");
  }
  return key;
}

/**
 * Cifra texto com AES-256-GCM.
 * Retorno: ciphertext+authTag em base64; IV separado em base64 (gravar em encryption_iv).
 */
export function encryptAes256Gcm(plaintext: string): { ciphertext: string; iv: string } {
  const key = encryptionKeyBuffer();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([encrypted, authTag]);
  return {
    ciphertext: payload.toString("base64"),
    iv: iv.toString("base64")
  };
}

/** Descriptografa payload produzido por encryptAes256Gcm (IV em encryption_iv). */
export function decryptAes256Gcm(ciphertextBase64: string, ivBase64: string): string {
  const key = encryptionKeyBuffer();
  const iv = Buffer.from(ivBase64, "base64");
  if (iv.length !== IV_LENGTH) {
    throw new Error("IV invalido para AES-256-GCM.");
  }
  const payload = Buffer.from(ciphertextBase64, "base64");
  if (payload.length <= AUTH_TAG_LENGTH) {
    throw new Error("Ciphertext invalido.");
  }
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(0, payload.length - AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
