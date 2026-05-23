import type { PoolClient } from "pg";
import {
  mapRowToCustomerAddress,
  type PortalClienteAddressFields
} from "./portal-cliente-address";
import { isCompletePayerAddress } from "../../payment-gateway/domain/require-payer-address";

export const PORTAL_CLIENTE_ADDRESS_REQUIRED = "PORTAL_CLIENTE_ADDRESS_REQUIRED";

const ADDRESS_SELECT = `endereco_cep, endereco_logradouro, endereco_numero, endereco_complemento,
  endereco_bairro, endereco_cidade, endereco_uf`;

export async function loadPortalClienteAddressFields(
  client: PoolClient,
  portalClienteId: string,
  automacaoTenantId: string
): Promise<PortalClienteAddressFields | null> {
  const r = await client.query<Record<string, unknown>>(
    `SELECT ${ADDRESS_SELECT}
     FROM portal.cliente
     WHERE id = $1::uuid AND tenant_id = $2
     LIMIT 1`,
    [portalClienteId, automacaoTenantId]
  );
  const row = r.rows[0];
  if (!row) {
    return null;
  }
  return {
    endereco_cep: row.endereco_cep ? String(row.endereco_cep) : null,
    endereco_logradouro: row.endereco_logradouro ? String(row.endereco_logradouro) : null,
    endereco_numero: row.endereco_numero ? String(row.endereco_numero) : null,
    endereco_complemento: row.endereco_complemento ? String(row.endereco_complemento) : null,
    endereco_bairro: row.endereco_bairro ? String(row.endereco_bairro) : null,
    endereco_cidade: row.endereco_cidade ? String(row.endereco_cidade) : null,
    endereco_uf: row.endereco_uf ? String(row.endereco_uf) : null
  };
}

export async function assertPortalClienteHasEmissionAddress(
  client: PoolClient,
  automacaoTenantId: string,
  portalClienteId: string,
  gatewayDisplayName: string
): Promise<void> {
  const fields = await loadPortalClienteAddressFields(client, portalClienteId, automacaoTenantId);
  if (!fields) {
    const err = new Error("PORTAL_CLIENTE_NOT_FOUND");
    throw err;
  }
  const address = mapRowToCustomerAddress(fields);
  if (!isCompletePayerAddress(address)) {
    const err = new Error(PORTAL_CLIENTE_ADDRESS_REQUIRED) as Error & {
      issues: Array<{ path: string; message: string }>;
    };
    err.issues = [
      {
        path: "portal_cliente_id",
        message: `${gatewayDisplayName} exige endereco completo do cliente (CEP, logradouro, bairro, cidade e UF).`
      }
    ];
    throw err;
  }
}
