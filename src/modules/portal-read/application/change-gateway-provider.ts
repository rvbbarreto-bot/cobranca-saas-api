import { z } from "zod";
import type { PoolClient } from "pg";
import type { AuditRequestContext } from "../../../platform/audit/audit-context";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import { encryptAes256Gcm } from "../../../platform/crypto/symmetric-encryption";
import type { GatewayCredentials } from "../../../modules/payment-gateway/domain/gateway-types";
import { decrypt } from "../../../platform/crypto/decrypt";
import {
  mergeGatewayCredentialsPatch,
  validateGatewayCredentials
} from "../../../platform/payment-gateway/credential-schema";
import { getProviderMeta } from "../../../platform/payment-gateway/provider-registry";
import {
  getEscritorioConfig,
  upsertEscritorioConfigFields,
  type EscritorioConfigRow
} from "../infrastructure/escritorio-config-repository";
import { insertGatewayChangeLog, listGatewayChangeLog } from "../infrastructure/gateway-change-log-repository";
import { mapEscritorioConfigPublic } from "./escritorio-config-use-cases";

export const patchGatewayProviderSchema = z.object({
  gateway_provider: z.enum(["asaas", "pagarme", "inter", "cora", "bb", "c6"]),
  gateway_credentials: z.record(z.string(), z.string()).optional(),
  gateway_api_key: z.string().min(10).optional()
});

export async function patchGatewayProviderUseCase(
  client: PoolClient,
  tenantId: string,
  raw: unknown,
  audit?: AuditRequestContext
): Promise<ReturnType<typeof mapEscritorioConfigPublic>> {
  const parsed = patchGatewayProviderSchema.safeParse(raw);
  if (!parsed.success) {
    const err = new Error("VALIDATION_ERROR");
    (err as Error & { issues: unknown }).issues = parsed.error.issues;
    throw err;
  }

  const before = await getEscritorioConfig(client, tenantId);
  const data = parsed.data;
  const provider = data.gateway_provider;
  const meta = getProviderMeta(provider);
  if (!meta.enabled) {
    const err = new Error("PROVIDER_DISABLED");
    throw err;
  }

  const fields: Record<string, unknown> = { gateway_provider: provider };
  let iv = before?.encryption_iv;

  if (data.gateway_credentials) {
    let credentialsToSave: GatewayCredentials = data.gateway_credentials;
    if (before?.gateway_credentials_encrypted?.trim() && before.encryption_iv?.trim()) {
      try {
        const existing = JSON.parse(
          decrypt(before.gateway_credentials_encrypted, before.encryption_iv)
        ) as GatewayCredentials;
        credentialsToSave = mergeGatewayCredentialsPatch(provider, existing, data.gateway_credentials);
      } catch {
        validateGatewayCredentials(provider, data.gateway_credentials);
      }
    } else {
      validateGatewayCredentials(provider, data.gateway_credentials);
    }
    const enc = encryptAes256Gcm(JSON.stringify(credentialsToSave));
    fields.gateway_credentials_encrypted = enc.ciphertext;
    iv = enc.iv;
    fields.encryption_iv = iv;
    if (meta.authType === "api_key" && data.gateway_credentials.api_key) {
      const keyEnc = encryptAes256Gcm(data.gateway_credentials.api_key);
      fields.gateway_api_key_encrypted = keyEnc.ciphertext;
    }
  } else if (data.gateway_api_key && meta.authType === "api_key") {
    const enc = encryptAes256Gcm(data.gateway_api_key);
    fields.gateway_api_key_encrypted = enc.ciphertext;
    iv = enc.iv;
    fields.encryption_iv = iv;
    fields.gateway_credentials_encrypted = encryptAes256Gcm(
      JSON.stringify({ api_key: data.gateway_api_key })
    ).ciphertext;
  } else if (meta.credentialFields.some((f) => f.required)) {
    const err = new Error("CREDENTIALS_REQUIRED");
    throw err;
  }

  const oldProvider = before?.gateway_provider ?? null;
  const row = await upsertEscritorioConfigFields(client, tenantId, fields);

  if (oldProvider !== provider) {
    await insertGatewayChangeLog(client, {
      tenantId,
      oldProvider,
      newProvider: provider,
      changedByUserId: audit?.userId ?? null,
      metadata: { source: "patch_gateway" }
    });
  }

  if (audit) {
    await writeAuditLog(
      {
        tenantId,
        userId: audit.userId,
        action: "update",
        resourceType: "escritorio_gateway",
        resourceId: tenantId,
        oldValue: before ? { gateway_provider: oldProvider } : undefined,
        newValue: { gateway_provider: provider },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent
      },
      client
    );
  }

  return mapEscritorioConfigPublic(row);
}

export async function listGatewayChangeHistoryUseCase(
  client: PoolClient,
  tenantId: string,
  limit = 20
): Promise<
  Array<{
    id: string;
    old_provider: string | null;
    new_provider: string;
    changed_at: string;
    changed_by_user_id: string | null;
  }>
> {
  const rows = await listGatewayChangeLog(client, tenantId, limit);
  return rows.map((r) => ({
    id: r.id,
    old_provider: r.old_provider,
    new_provider: r.new_provider,
    changed_at: r.changed_at.toISOString(),
    changed_by_user_id: r.changed_by_user_id
  }));
}
