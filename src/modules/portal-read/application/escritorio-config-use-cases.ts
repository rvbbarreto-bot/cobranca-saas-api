import { z } from "zod";
import type { PoolClient } from "pg";
import type { AuditRequestContext } from "../../../platform/audit/audit-context";
import { writeAuditLog } from "../../../platform/audit/audit.service";
import { encryptAes256Gcm } from "../../../platform/crypto/symmetric-encryption";
import { maskSecret } from "../../../platform/crypto/mask-secret";
import {
  getEscritorioConfig,
  upsertEscritorioConfigFields,
  type EscritorioConfigRow
} from "../infrastructure/escritorio-config-repository";

export const patchEscritorioConfigSchema = z.object({
  cnpj_emissor: z.string().length(14).regex(/^\d+$/).optional(),
  razao_social: z.string().min(3).max(300).optional(),
  inscricao_municipal: z.string().max(32).optional(),
  regime_tributario: z.enum(["simples", "presumido", "real"]).optional(),
  codigo_municipio: z.string().length(7).regex(/^\d+$/).optional(),
  aliquota_iss: z.number().min(0).max(10).optional(),
  gateway_provider: z.enum(["asaas", "pagarme"]).optional(),
  gateway_api_key: z.string().min(10).optional(),
  whatsapp_provider: z.enum(["zapi", "twilio"]).optional(),
  whatsapp_token: z.string().min(1).optional()
});

export function mapEscritorioConfigPublic(row: EscritorioConfigRow | null) {
  if (!row) {
    return null;
  }
  return {
    tenant_id: row.tenant_id,
    cnpj_emissor: row.cnpj_emissor,
    razao_social: row.razao_social,
    inscricao_municipal: row.inscricao_municipal,
    regime_tributario: row.regime_tributario,
    codigo_municipio: row.codigo_municipio,
    aliquota_iss: row.aliquota_iss,
    gateway_provider: row.gateway_provider,
    gateway_api_key: maskSecret(row.gateway_api_key_encrypted),
    whatsapp_provider: row.whatsapp_provider,
    whatsapp_token: maskSecret(row.whatsapp_token_encrypted)
  };
}

export async function getEscritorioConfigUseCase(
  client: PoolClient,
  tenantId: string
): Promise<ReturnType<typeof mapEscritorioConfigPublic>> {
  const row = await getEscritorioConfig(client, tenantId);
  return mapEscritorioConfigPublic(row);
}

export async function patchEscritorioConfigUseCase(
  client: PoolClient,
  tenantId: string,
  raw: unknown,
  audit?: AuditRequestContext
): Promise<ReturnType<typeof mapEscritorioConfigPublic>> {
  const parsed = patchEscritorioConfigSchema.safeParse(raw);
  if (!parsed.success) {
    const err = new Error("VALIDATION_ERROR");
    (err as Error & { issues: unknown }).issues = parsed.error.issues;
    throw err;
  }

  const before = await getEscritorioConfig(client, tenantId);
  const fields: Record<string, unknown> = {};
  const data = parsed.data;

  if (data.cnpj_emissor !== undefined) fields.cnpj_emissor = data.cnpj_emissor;
  if (data.razao_social !== undefined) fields.razao_social = data.razao_social;
  if (data.inscricao_municipal !== undefined) fields.inscricao_municipal = data.inscricao_municipal;
  if (data.regime_tributario !== undefined) fields.regime_tributario = data.regime_tributario;
  if (data.codigo_municipio !== undefined) fields.codigo_municipio = data.codigo_municipio;
  if (data.aliquota_iss !== undefined) fields.aliquota_iss = data.aliquota_iss;
  if (data.gateway_provider !== undefined) fields.gateway_provider = data.gateway_provider;
  if (data.whatsapp_provider !== undefined) fields.whatsapp_provider = data.whatsapp_provider;

  let iv = before?.encryption_iv;
  if (data.gateway_api_key) {
    const enc = encryptAes256Gcm(data.gateway_api_key);
    fields.gateway_api_key_encrypted = enc.ciphertext;
    iv = enc.iv;
    fields.encryption_iv = iv;
  }
  if (data.whatsapp_token) {
    const enc = encryptAes256Gcm(data.whatsapp_token);
    fields.whatsapp_token_encrypted = enc.ciphertext;
    if (!fields.encryption_iv) {
      fields.encryption_iv = enc.iv;
    }
  }

  const row = await upsertEscritorioConfigFields(client, tenantId, fields);

  if (audit) {
    await writeAuditLog(
      {
        tenantId,
        userId: audit.userId,
        action: "update",
        resourceType: "escritorio_config",
        resourceId: tenantId,
        oldValue: before ? mapEscritorioConfigPublic(before) ?? undefined : undefined,
        newValue: mapEscritorioConfigPublic(row) ?? undefined,
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent
      },
      client
    );
  }

  return mapEscritorioConfigPublic(row);
}
