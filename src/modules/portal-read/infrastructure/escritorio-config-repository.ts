import type { PoolClient } from "pg";

export type EscritorioConfigRow = {
  tenant_id: string;
  cnpj_emissor: string | null;
  razao_social: string | null;
  inscricao_municipal: string | null;
  regime_tributario: string | null;
  codigo_municipio: string | null;
  aliquota_iss: string | null;
  gateway_provider: string | null;
  gateway_api_key_encrypted: string | null;
  encryption_iv: string | null;
  whatsapp_provider: string | null;
  whatsapp_token_encrypted: string | null;
};

export async function getEscritorioConfig(
  client: PoolClient,
  tenantId: string
): Promise<EscritorioConfigRow | null> {
  const r = await client.query<EscritorioConfigRow>(
    `SELECT tenant_id, cnpj_emissor, razao_social, inscricao_municipal, regime_tributario,
            codigo_municipio, aliquota_iss::text, gateway_provider,
            gateway_api_key_encrypted, encryption_iv,
            whatsapp_provider, whatsapp_token_encrypted
     FROM escritorio_config WHERE tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  return r.rows[0] ?? null;
}

export async function upsertEscritorioConfigFields(
  client: PoolClient,
  tenantId: string,
  fields: Record<string, unknown>
): Promise<EscritorioConfigRow> {
  const cols: string[] = ["tenant_id"];
  const vals: unknown[] = [tenantId];
  const updates: string[] = [];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    cols.push(key);
    vals.push(value);
    updates.push(`${key} = EXCLUDED.${key}`);
  }

  updates.push("updated_at = now()");

  const placeholders = vals.map((_, i) => `$${i + 1}`).join(", ");
  const r = await client.query<EscritorioConfigRow>(
    `INSERT INTO escritorio_config (${cols.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (tenant_id) DO UPDATE SET ${updates.join(", ")}
     RETURNING tenant_id, cnpj_emissor, razao_social, inscricao_municipal, regime_tributario,
               codigo_municipio, aliquota_iss::text, gateway_provider,
               gateway_api_key_encrypted, encryption_iv,
               whatsapp_provider, whatsapp_token_encrypted`,
    vals
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error("Falha ao gravar escritorio_config.");
  }
  return row;
}
