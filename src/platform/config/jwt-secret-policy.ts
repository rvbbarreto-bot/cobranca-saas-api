/**
 * Politica de JWT_SECRET para producao (check:prod-env, boot warnings).
 */

const WEAK_SUBSTRINGS = [
  "trocar",
  "change-me",
  "your-secret",
  "example",
  "minimo_32",
  "openssl_rand",
  "placeholder"
] as const;

/** Valores literais de exemplo em .env.example — nunca usar em producao. */
const KNOWN_PLACEHOLDER_SECRETS = new Set([
  "trocar_openssl_rand_base64_64_minimo_32_caracteres",
  "change-me-to-a-strong-secret"
]);

export type JwtSecretValidation =
  | { ok: true }
  | { ok: false; reason: string };

export function validateJwtSecretForProduction(secret: string | undefined): JwtSecretValidation {
  const trimmed = secret?.trim();
  if (!trimmed) {
    return { ok: false, reason: "JWT_SECRET ausente" };
  }

  if (trimmed.length < 32) {
    return {
      ok: false,
      reason: `JWT_SECRET ausente ou com menos de 32 caracteres (atual: ${trimmed.length})`
    };
  }

  const lower = trimmed.toLowerCase();
  if (KNOWN_PLACEHOLDER_SECRETS.has(lower)) {
    return {
      ok: false,
      reason: "JWT_SECRET parece placeholder de exemplo — gere secret forte (openssl rand -base64 64)"
    };
  }

  for (const frag of WEAK_SUBSTRINGS) {
    if (lower.includes(frag)) {
      return {
        ok: false,
        reason: "JWT_SECRET parece placeholder de exemplo — gere secret forte (openssl rand -base64 64)"
      };
    }
  }

  return { ok: true };
}
