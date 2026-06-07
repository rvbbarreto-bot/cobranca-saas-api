import type { Pool } from "pg";
import { decryptAes256Gcm, encryptAes256Gcm } from "../../../platform/crypto/symmetric-encryption";

export type SerproConfigPublic = {
  organization_id: string;
  ambiente: "demo" | "prod";
  contratante_cnpj: string;
  serpro_enabled: boolean;
  consumer_key_configured: boolean;
  consumer_secret_configured: boolean;
  updated_at: string;
};

export type SerproConfigRow = {
  id: string;
  organizationId: string;
  ambiente: "demo" | "prod";
  contratanteCnpj: string;
  consumerKeyEncrypted: string | null;
  consumerSecretEncrypted: string | null;
  encryptionIv: string;
  consumerSecretIv: string | null;
  serproEnabled: boolean;
  updatedAt: string;
};

function maskCnpj(cnpj: string): string {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return "**************";
  return `${d.slice(0, 2)}.***.***/****-${d.slice(12)}`;
}

export function mapSerproConfigPublic(row: SerproConfigRow): SerproConfigPublic {
  return {
    organization_id: row.organizationId,
    ambiente: row.ambiente,
    contratante_cnpj: maskCnpj(row.contratanteCnpj),
    serpro_enabled: row.serproEnabled,
    consumer_key_configured: Boolean(row.consumerKeyEncrypted?.trim()),
    consumer_secret_configured: Boolean(row.consumerSecretEncrypted?.trim()),
    updated_at: row.updatedAt
  };
}

function mapRow(row: {
  id: string;
  organization_id: string;
  ambiente: string;
  contratante_cnpj: string;
  consumer_key_encrypted: string | null;
  consumer_secret_encrypted: string | null;
  encryption_iv: string;
  metadata: { consumer_secret_iv?: string } | null;
  serpro_enabled: boolean;
  updated_at: Date;
}): SerproConfigRow {
  return {
    id: row.id,
    organizationId: row.organization_id,
    ambiente: row.ambiente as "demo" | "prod",
    contratanteCnpj: row.contratante_cnpj,
    consumerKeyEncrypted: row.consumer_key_encrypted,
    consumerSecretEncrypted: row.consumer_secret_encrypted,
    encryptionIv: row.encryption_iv,
    consumerSecretIv:
      typeof row.metadata?.consumer_secret_iv === "string" ? row.metadata.consumer_secret_iv : null,
    serproEnabled: row.serpro_enabled,
    updatedAt: row.updated_at.toISOString()
  };
}

export async function getSerproConfigByOrganizationId(
  pool: Pool,
  organizationId: string
): Promise<SerproConfigRow | null> {
  const r = await pool.query(
    `SELECT id::text, organization_id::text, ambiente, contratante_cnpj,
            consumer_key_encrypted, consumer_secret_encrypted, encryption_iv,
            metadata, serpro_enabled, updated_at
     FROM fiscal.serpro_config
     WHERE organization_id = $1::uuid
     LIMIT 1`,
    [organizationId]
  );
  const row = r.rows[0];
  return row ? mapRow(row) : null;
}

export async function upsertSerproConfig(
  pool: Pool,
  organizationId: string,
  input: {
    ambiente?: "demo" | "prod";
    contratanteCnpj: string;
    consumerKey?: string;
    consumerSecret?: string;
    serproEnabled?: boolean;
  }
): Promise<SerproConfigRow> {
  const cnpj = input.contratanteCnpj.replace(/\D/g, "");
  if (cnpj.length !== 14) {
    throw new Error("CNPJ_CONTRATANTE_INVALIDO");
  }

  const existing = await getSerproConfigByOrganizationId(pool, organizationId);
  let iv = existing?.encryptionIv;
  let keyEnc = existing?.consumerKeyEncrypted ?? null;
  let secretEnc = existing?.consumerSecretEncrypted ?? null;
  let secretIv: string | undefined;

  if (input.consumerKey?.trim()) {
    const enc = encryptAes256Gcm(input.consumerKey.trim());
    keyEnc = enc.ciphertext;
    iv = enc.iv;
  }
  if (input.consumerSecret?.trim()) {
    const enc = encryptAes256Gcm(input.consumerSecret.trim());
    secretEnc = enc.ciphertext;
    secretIv = enc.iv;
  }
  if (!iv) {
    const enc = encryptAes256Gcm("unset");
    iv = enc.iv;
  }

  const ambiente = input.ambiente ?? existing?.ambiente ?? "demo";
  const serproEnabled = input.serproEnabled ?? existing?.serproEnabled ?? false;

  const metadata =
    secretIv !== undefined
      ? JSON.stringify({ consumer_secret_iv: secretIv })
      : existing
        ? undefined
        : JSON.stringify({});

  const r = await pool.query(
    `INSERT INTO fiscal.serpro_config (
       organization_id, ambiente, contratante_cnpj,
       consumer_key_encrypted, consumer_secret_encrypted, encryption_iv,
       serpro_enabled, metadata, updated_at
     ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7,
       COALESCE($8::jsonb, '{}'::jsonb), now())
     ON CONFLICT (organization_id) DO UPDATE SET
       ambiente = EXCLUDED.ambiente,
       contratante_cnpj = EXCLUDED.contratante_cnpj,
       consumer_key_encrypted = COALESCE(EXCLUDED.consumer_key_encrypted, fiscal.serpro_config.consumer_key_encrypted),
       consumer_secret_encrypted = COALESCE(EXCLUDED.consumer_secret_encrypted, fiscal.serpro_config.consumer_secret_encrypted),
       encryption_iv = EXCLUDED.encryption_iv,
       serpro_enabled = EXCLUDED.serpro_enabled,
       metadata = CASE
         WHEN $8 IS NOT NULL THEN fiscal.serpro_config.metadata || EXCLUDED.metadata
         ELSE fiscal.serpro_config.metadata
       END,
       updated_at = now()
     RETURNING id::text, organization_id::text, ambiente, contratante_cnpj,
               consumer_key_encrypted, consumer_secret_encrypted, encryption_iv,
               serpro_enabled, updated_at`,
    [organizationId, ambiente, cnpj, keyEnc, secretEnc, iv, serproEnabled, metadata ?? null]
  );

  return mapRow(r.rows[0]);
}

export function decryptSerproConsumerKey(row: SerproConfigRow): string | null {
  if (!row.consumerKeyEncrypted?.trim()) return null;
  return decryptAes256Gcm(row.consumerKeyEncrypted, row.encryptionIv);
}

export function decryptSerproConsumerSecret(row: SerproConfigRow): string | null {
  if (!row.consumerSecretEncrypted?.trim() || !row.consumerSecretIv) return null;
  return decryptAes256Gcm(row.consumerSecretEncrypted, row.consumerSecretIv);
}
