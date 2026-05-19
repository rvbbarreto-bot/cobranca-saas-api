import type { PoolClient } from "pg";
import { encryptAes256Gcm } from "../platform/crypto/symmetric-encryption";

/**
 * Grava ou atualiza escritorio_config com API key Asaas cifrada (tenant publico UUID).
 */
export async function upsertEscritorioAsaasConfig(
  client: PoolClient,
  tenantId: string,
  asaasApiKey: string
): Promise<void> {
  const { ciphertext, iv } = encryptAes256Gcm(asaasApiKey.trim());
  await client.query(
    `INSERT INTO escritorio_config (tenant_id, gateway_provider, gateway_api_key_encrypted, encryption_iv)
     VALUES ($1, 'asaas', $2, $3)
     ON CONFLICT (tenant_id) DO UPDATE SET
       gateway_provider = EXCLUDED.gateway_provider,
       gateway_api_key_encrypted = EXCLUDED.gateway_api_key_encrypted,
       encryption_iv = EXCLUDED.encryption_iv,
       updated_at = now()`,
    [tenantId, ciphertext, iv]
  );
}
