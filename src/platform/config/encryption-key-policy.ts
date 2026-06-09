/**
 * Politica de ENCRYPTION_KEY para producao (cofre fiscal, gateway, SERPRO config).
 */

const KNOWN_PLACEHOLDER_KEYS = new Set([
  "trocar_openssl_rand_hex_32_para_aes256gcm"
]);

const WEAK_SUBSTRINGS = ["trocar", "change-me", "placeholder", "example"] as const;

export type EncryptionKeyValidation = { ok: true } | { ok: false; reason: string };

export function validateEncryptionKeyForProduction(key: string | undefined): EncryptionKeyValidation {
  const trimmed = key?.trim();
  if (!trimmed) {
    return { ok: false, reason: "ENCRYPTION_KEY ausente" };
  }

  const lower = trimmed.toLowerCase();
  if (KNOWN_PLACEHOLDER_KEYS.has(lower)) {
    return {
      ok: false,
      reason: "ENCRYPTION_KEY parece placeholder de exemplo — gere com openssl rand -hex 32"
    };
  }

  for (const frag of WEAK_SUBSTRINGS) {
    if (lower.includes(frag)) {
      return {
        ok: false,
        reason: "ENCRYPTION_KEY parece placeholder de exemplo — gere com openssl rand -hex 32"
      };
    }
  }

  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    return {
      ok: false,
      reason: "ENCRYPTION_KEY deve ter 64 caracteres hexadecimais (32 bytes AES-256-GCM)"
    };
  }

  return { ok: true };
}
