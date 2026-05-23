import type { GatewayCredentials } from "../../modules/payment-gateway/domain/gateway-types";
import {
  GatewayCredentialsMissingError,
  GatewayCredentialsValidationError
} from "../../modules/payment-gateway/domain/payment-gateway-error";
import { getProviderMeta } from "./provider-registry";
import { validateMtlsPemPair } from "./mtls-credential-validation";

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
    const cert = credentials.certificate_pem?.trim();
    const key = credentials.private_key_pem?.trim();
    if (cert && key) {
      const pemCheck = validateMtlsPemPair(cert, key);
      if (!pemCheck.ok) {
        throw new GatewayCredentialsValidationError(provider, pemCheck.message);
      }
    }
  }
}
