import type { PoolClient } from "pg";
import type { PaymentGatewayAdapter } from "../domain/payment-gateway.interface";
import type { GatewayAdapterContext, GatewayCredentials } from "../domain/gateway-types";
import {
  GatewayNotConfiguredError,
  UnsupportedGatewayProviderError
} from "../domain/payment-gateway-error";
import { decrypt } from "../../../platform/crypto/decrypt";
import { validateGatewayCredentials } from "../../../platform/payment-gateway/credential-schema";
import { getProviderMeta } from "../../../platform/payment-gateway/provider-registry";
import { AsaasAdapter } from "../infrastructure/asaas/asaas-adapter";
import { InterAdapter } from "../infrastructure/inter/inter-adapter";
import { CoraAdapter } from "../infrastructure/cora/cora-adapter";

export type GetGatewayForTenantDeps = {
  decrypt?: (ciphertext: string, iv: string) => string;
  sandbox?: boolean;
  loaders?: Partial<typeof ADAPTER_LOADERS>;
};

type EscritorioGatewayRow = {
  gateway_provider: string | null;
  gateway_credentials_encrypted: string | null;
  gateway_api_key_encrypted: string | null;
  encryption_iv: string | null;
};

export type AdapterLoader = (ctx: GatewayAdapterContext) => PaymentGatewayAdapter;

export const ADAPTER_LOADERS: Record<string, AdapterLoader> = {
  asaas: (ctx) => {
    const apiKey = ctx.credentials.api_key?.trim();
    if (!apiKey) {
      throw new GatewayNotConfiguredError(ctx.tenantId);
    }
    const baseUrl =
      process.env.ASAAS_API_URL?.trim() ||
      (ctx.sandbox ? "https://sandbox.asaas.com/api/v3" : "https://api.asaas.com/v3");
    return new AsaasAdapter({ apiKey, baseUrl });
  },
  inter: (ctx) => new InterAdapter(ctx),
  cora: (ctx) => new CoraAdapter(ctx)
};

function resolveCredentials(
  row: EscritorioGatewayRow,
  tenantId: string,
  decryptFn: (ciphertext: string, iv: string) => string
): GatewayCredentials {
  const iv = row.encryption_iv?.trim();
  if (!iv) {
    throw new GatewayNotConfiguredError(tenantId);
  }

  if (row.gateway_credentials_encrypted?.trim()) {
    const json = decryptFn(row.gateway_credentials_encrypted.trim(), iv);
    const parsed = JSON.parse(json) as GatewayCredentials;
    if (!parsed || typeof parsed !== "object") {
      throw new GatewayNotConfiguredError(tenantId);
    }
    return parsed;
  }

  if (row.gateway_api_key_encrypted?.trim()) {
    return { api_key: decryptFn(row.gateway_api_key_encrypted.trim(), iv) };
  }

  throw new GatewayNotConfiguredError(tenantId);
}

export async function getGatewayForTenant(
  client: PoolClient,
  tenantId: string,
  deps: GetGatewayForTenantDeps = {}
): Promise<PaymentGatewayAdapter> {
  const decryptFn = deps.decrypt ?? decrypt;
  const sandbox = deps.sandbox ?? process.env.NODE_ENV !== "production";

  const r = await client.query<EscritorioGatewayRow>(
    `SELECT gateway_provider, gateway_credentials_encrypted,
            gateway_api_key_encrypted, encryption_iv
     FROM escritorio_config
     WHERE tenant_id = $1
     LIMIT 1`,
    [tenantId]
  );
  const row = r.rows[0];
  if (!row) {
    throw new GatewayNotConfiguredError(tenantId);
  }

  const provider = String(row.gateway_provider || "asaas").trim().toLowerCase();
  let meta;
  try {
    meta = getProviderMeta(provider);
  } catch {
    throw new UnsupportedGatewayProviderError(provider);
  }
  if (!meta.enabled) {
    throw new UnsupportedGatewayProviderError(provider);
  }

  const credentials = resolveCredentials(row, tenantId, decryptFn);
  validateGatewayCredentials(provider, credentials);

  const ctx: GatewayAdapterContext = {
    tenantId,
    provider,
    credentials,
    sandbox
  };

  const loaders = { ...ADAPTER_LOADERS, ...deps.loaders };
  const loader = loaders[provider];
  if (!loader) {
    throw new UnsupportedGatewayProviderError(provider);
  }

  return loader(ctx);
}
