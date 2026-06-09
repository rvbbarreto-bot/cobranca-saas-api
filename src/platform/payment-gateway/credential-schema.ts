import type { GatewayCredentials } from "../../modules/payment-gateway/domain/gateway-types";
import {
  GatewayCredentialsMissingError,
  GatewayCredentialsValidationError
} from "../../modules/payment-gateway/domain/payment-gateway-error";
import { getProviderMeta } from "./provider-registry";
import { validateInterCredentialAppAlignment } from "./inter-credential-alignment";
import { sanitizePemPaste, validateMtlsPemPair } from "./mtls-credential-validation";

const MTLS_PEM_PROVIDERS = new Set(["inter", "cora", "c6"]);

export function validateGatewayCredentials(
  provider: string,
  credentials: GatewayCredentials
): void {
  const meta = getProviderMeta(provider);
  const missing: string[] = [];
  for (const field of meta.credentialFields) {
    if (!field.required) continue;
    const value = credentials[field.key]?.trim();
    if (!value) {
      missing.push(field.key);
    }
  }
  if (missing.length > 0) {
    throw new GatewayCredentialsMissingError(provider, missing);
  }

  if (MTLS_PEM_PROVIDERS.has(provider)) {
    if (credentials.certificate_pem?.trim()) {
      credentials.certificate_pem = sanitizePemPaste(credentials.certificate_pem);
    }
    if (credentials.private_key_pem?.trim()) {
      credentials.private_key_pem = sanitizePemPaste(credentials.private_key_pem);
    }
    const cert = credentials.certificate_pem;
    const key = credentials.private_key_pem;
    if (cert && key) {
      const pemCheck = validateMtlsPemPair(cert, key);
      if (!pemCheck.ok) {
        throw new GatewayCredentialsValidationError(provider, pemCheck.message);
      }
    }
  }

  if (provider === "inter") {
    const clientId = credentials.client_id?.trim() ?? "";
    const cert = credentials.certificate_pem?.trim() ?? "";
    if (clientId && cert) {
      const alignment = validateInterCredentialAppAlignment(clientId, cert);
      if (!alignment.ok) {
        throw new GatewayCredentialsValidationError(provider, alignment.message);
      }
    }
  }
}

/** Mescla credenciais existentes com PATCH parcial e valida o conjunto final. */
export function mergeGatewayCredentialsPatch(
  provider: string,
  existing: GatewayCredentials,
  patch: GatewayCredentials
): GatewayCredentials {
  const merged: GatewayCredentials = { ...existing };
  for (const [key, value] of Object.entries(patch)) {
    const trimmed = value?.trim();
    if (trimmed) {
      merged[key] = trimmed;
    }
  }
  validateGatewayCredentials(provider, merged);
  return merged;
}
