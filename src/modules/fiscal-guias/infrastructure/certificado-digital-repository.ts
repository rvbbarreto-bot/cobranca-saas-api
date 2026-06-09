import type { Pool, PoolClient } from "pg";
import { getPool } from "../../../platform/persistence/pool";
import {
  decryptCertificadoBundle,
  encryptCertificadoBundle,
  type DecryptedCertificadoPem
} from "./certificate-pem-crypto";
import {
  getActiveVaultCertForCliente,
  getActiveVaultCertMetaForCliente,
  insertCertificateVault,
  resolveOrganizationIdForTenant
} from "./certificate-vault-repository";
import { rethrowFiscalSchemaError } from "./fiscal-schema";

export type { DecryptedCertificadoPem } from "./certificate-pem-crypto";

export type CertificadoDigitalRow = {
  id: string;
  portal_cliente_id: string;
  label: string;
  valid_from: string;
  valid_until: string;
  ativo: boolean;
  certificate_vault_id: string | null;
  created_at: Date;
  updated_at: Date;
};

function vaultRowToCertificadoRow(vault: {
  id: string;
  portal_cliente_id: string | null;
  label: string;
  valid_from: string;
  valid_until: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}): CertificadoDigitalRow {
  return {
    id: vault.id,
    portal_cliente_id: vault.portal_cliente_id ?? "",
    label: vault.label,
    valid_from: vault.valid_from,
    valid_until: vault.valid_until,
    ativo: vault.status === "active" || vault.status === "expiring",
    certificate_vault_id: vault.id,
    created_at: vault.created_at,
    updated_at: vault.updated_at
  };
}

export async function insertCertificadoDigital(
  client: PoolClient,
  input: {
    tenantId: string;
    portalClienteId: string;
    label: string;
    validFrom: string;
    validUntil: string;
    certificadoPem: string;
    chavePrivadaPem: string;
    uploadedByUserId?: string;
  }
): Promise<CertificadoDigitalRow> {
  const organizationId = await resolveOrganizationIdForTenant(client, input.tenantId);
  if (!organizationId) {
    throw new Error("ORGANIZATION_NOT_FOUND_FOR_TENANT");
  }

  const vault = await insertCertificateVault(client, {
    organizationId,
    automacaoTenantId: input.tenantId,
    portalClienteId: input.portalClienteId,
    label: input.label,
    validFrom: input.validFrom,
    validUntil: input.validUntil,
    certificadoPem: input.certificadoPem,
    chavePrivadaPem: input.chavePrivadaPem,
    uploadedByUserId: input.uploadedByUserId
  });

  return vaultRowToCertificadoRow(vault);
}

/** Metadados do certificado ativo (sem PEM) — vault primário, legado fallback. */
export async function getActiveCertificadoMetaForCliente(
  tenantId: string,
  portalClienteId: string,
  db: Pool | PoolClient = getPool()
): Promise<CertificadoDigitalRow | null> {
  const vault = await getActiveVaultCertMetaForCliente(tenantId, portalClienteId, db);
  if (vault) {
    return vaultRowToCertificadoRow(vault);
  }

  try {
    const r = await db.query<CertificadoDigitalRow & { certificate_vault_id?: string | null }>(
      `SELECT
         id::text AS id,
         portal_cliente_id::text AS portal_cliente_id,
         label,
         valid_from::text AS valid_from,
         valid_until::text AS valid_until,
         ativo,
         NULL::text AS certificate_vault_id,
         created_at,
         updated_at
       FROM fiscal.certificado_digital
       WHERE tenant_id = $1
         AND portal_cliente_id = $2::uuid
         AND ativo = true
         AND valid_until >= CURRENT_DATE
       ORDER BY valid_until DESC, created_at DESC
       LIMIT 1`,
      [tenantId, portalClienteId]
    );
    return r.rows[0] ?? null;
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
  }
}

export async function getActiveCertificadoForCliente(
  tenantId: string,
  portalClienteId: string,
  db: Pool | PoolClient = getPool()
): Promise<(CertificadoDigitalRow & { decrypted: DecryptedCertificadoPem }) | null> {
  const vault = await getActiveVaultCertForCliente(tenantId, portalClienteId, db);
  if (vault) {
    return {
      ...vaultRowToCertificadoRow(vault),
      decrypted: vault.decrypted
    };
  }

  try {
    const r = await db.query<
      CertificadoDigitalRow & {
        cert_encrypted: string;
        key_encrypted: string;
        encryption_iv: string;
      }
    >(
      `SELECT
         id::text AS id,
         portal_cliente_id::text AS portal_cliente_id,
         label,
         valid_from::text AS valid_from,
         valid_until::text AS valid_until,
         ativo,
         NULL::text AS certificate_vault_id,
         created_at,
         updated_at,
         cert_encrypted,
         key_encrypted,
         encryption_iv
       FROM fiscal.certificado_digital
       WHERE tenant_id = $1
         AND portal_cliente_id = $2::uuid
         AND ativo = true
         AND valid_until >= CURRENT_DATE
       ORDER BY valid_until DESC, created_at DESC
       LIMIT 1`,
      [tenantId, portalClienteId]
    );
    const row = r.rows[0];
    if (!row) {
      return null;
    }
    const decrypted = decryptCertificadoBundle(
      row.cert_encrypted,
      row.key_encrypted,
      row.encryption_iv
    );
    const { cert_encrypted: _c, key_encrypted: _k, encryption_iv: _i, ...meta } = row;
    return { ...meta, decrypted };
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
  }
}

export async function portalClienteBelongsToTenant(
  tenantId: string,
  portalClienteId: string,
  db: Pool | PoolClient = getPool()
): Promise<boolean> {
  const r = await db.query<{ ok: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM portal.cliente
       WHERE id = $2::uuid AND tenant_id = $1
     ) AS ok`,
    [tenantId, portalClienteId]
  );
  return Boolean(r.rows[0]?.ok);
}

export async function getPortalClienteCnpj(
  tenantId: string,
  portalClienteId: string,
  db: Pool | PoolClient = getPool()
): Promise<string | null> {
  const r = await db.query<{ documento: string }>(
    `SELECT documento FROM portal.cliente
     WHERE id = $2::uuid AND tenant_id = $1 AND tipo_documento = 'cnpj'
     LIMIT 1`,
    [tenantId, portalClienteId]
  );
  return r.rows[0]?.documento ?? null;
}

/** @deprecated Use certificate-pem-crypto — reexport para scripts legados. */
export { encryptCertificadoBundle, decryptCertificadoBundle };
