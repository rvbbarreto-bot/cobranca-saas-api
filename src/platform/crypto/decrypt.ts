import { decryptAes256Gcm } from "./symmetric-encryption";

/** Descriptografa texto AES-256-GCM (ciphertext + IV em base64). */
export function decrypt(encryptedText: string, iv: string): string {
  return decryptAes256Gcm(encryptedText, iv);
}
