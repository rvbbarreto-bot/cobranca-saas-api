import type { GatewayCredentials } from "../../modules/payment-gateway/domain/gateway-types";
import { GatewayCredentialsMissingError } from "../../modules/payment-gateway/domain/payment-gateway-error";
import { getProviderMeta } from "./provider-registry";

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
}
