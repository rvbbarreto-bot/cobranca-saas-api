import type { GatewayCredentials } from "../../modules/payment-gateway/domain/gateway-types";
import {
  GatewayCredentialsMissingError,
  GatewayCredentialsValidationError
} from "../../modules/payment-gateway/domain/payment-gateway-error";

/** Provedores com certificado + chave mTLS (OAuth). */
export const MTLS_OAUTH_PROVIDERS = new Set(["inter", "cora", "c6"]);

const OAUTH_FIELDS = ["client_id", "client_secret"] as const;

export function isMtlsFullBundlePolicyEnabled(): boolean {
  const raw = process.env.GATEWAY_MTLS_REQUIRE_FULL_BUNDLE?.trim().toLowerCase();
  if (raw === "false" || raw === "0") {
    return false;
  }
  return true;
}

export function isMtlsOAuthProvider(provider: string): boolean {
  return MTLS_OAUTH_PROVIDERS.has(provider.trim().toLowerCase());
}

function oauthFieldsInPatch(credentials: GatewayCredentials | undefined): string[] {
  if (!credentials) {
    return [];
  }
  return OAUTH_FIELDS.filter((key) => Boolean(credentials[key]?.trim()));
}

export type MtlsFullBundleContext = {
  provider: string;
  credentialsAlreadyConfigured: boolean;
  certificateUploadId?: string;
  gatewayCredentials?: GatewayCredentials;
};

/**
 * RF pacote completo: na alteração de credenciais mTLS, exige upload PEM + OAuth completo.
 * @see docs/ADR_GATEWAY_MTLS_FULL_BUNDLE.md
 */
export function assertMtlsFullBundleOnUpdate(ctx: MtlsFullBundleContext): void {
  if (!isMtlsFullBundlePolicyEnabled()) {
    return;
  }
  const provider = ctx.provider.trim().toLowerCase();
  if (!isMtlsOAuthProvider(provider)) {
    return;
  }
  if (!ctx.credentialsAlreadyConfigured) {
    return;
  }

  const oauthTouched = oauthFieldsInPatch(ctx.gatewayCredentials);
  const pemTouched = Boolean(ctx.certificateUploadId);
  const anyCredentialChange = pemTouched || oauthTouched.length > 0;

  if (!anyCredentialChange) {
    return;
  }

  if (!ctx.certificateUploadId) {
    throw new GatewayCredentialsValidationError(
      provider,
      "Para alterar credenciais do gateway mTLS, envie novamente certificado e chave privada (upload) " +
        "junto com Client ID e Client Secret da mesma integracao no Portal Developers. " +
        "Nao e permitido reutilizar certificados gravados anteriormente."
    );
  }

  const missing = OAUTH_FIELDS.filter((key) => !ctx.gatewayCredentials?.[key]?.trim());
  if (missing.length > 0) {
    throw new GatewayCredentialsMissingError(provider, [...missing]);
  }
}

/** Substitui merge quando upload novo + politica ativa + reconfiguracao. */
export function shouldReplaceMtlsCredentialsOnUpload(ctx: MtlsFullBundleContext): boolean {
  if (!ctx.certificateUploadId) {
    return false;
  }
  if (!isMtlsOAuthProvider(ctx.provider)) {
    return false;
  }
  if (!ctx.credentialsAlreadyConfigured) {
    return false;
  }
  return isMtlsFullBundlePolicyEnabled();
}
