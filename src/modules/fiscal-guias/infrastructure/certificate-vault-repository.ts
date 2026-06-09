import type { Pool, PoolClient } from "pg";
import { getOrganizationByAutomacaoTenantId } from "../../exeq-platform/infrastructure/organization-repository";
import {
  computeCertificateVaultStatus,
  decryptCertificadoBundle,
  encryptCertificadoBundle,
  type DecryptedCertificadoPem
} from "./certificate-pem-crypto";
import { rethrowFiscalSchemaError } from "./fiscal-schema";

export type CertificateVaultRow = {
  id: string;
  organization_id: string;
  automacao_tenant_id: string;
  portal_cliente_id: string | null;
  owner_type: "empresa" | "escritorio" | "exeq";
  label: string;
  valid_from: string;
  valid_until: string;
  status: "active" | "expiring" | "revoked" | "expired";
  legacy_certificado_id: string | null;
  created_at: Date;
  updated_at: Date;
};

function mapMetaRow(row: CertificateVaultRow & Record<string, unknown>): CertificateVaultRow {
  return {
    id: row.id,
    organization_id: row.organization_id,
    automacao_tenant_id: row.automacao_tenant_id,
    portal_cliente_id: row.portal_cliente_id,
    owner_type: row.owner_type as CertificateVaultRow["owner_type"],
    label: row.label,
    valid_from: row.valid_from,
    valid_until: row.valid_until,
    status: row.status as CertificateVaultRow["status"],
    legacy_certificado_id: row.legacy_certificado_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

const SELECT_META = `
  SELECT
    id::text AS id,
    organization_id::text AS organization_id,
    automacao_tenant_id,
    portal_cliente_id::text AS portal_cliente_id,
    owner_type,
    label,
    valid_from::text AS valid_from,
    valid_until::text AS valid_until,
    status,
    legacy_certificado_id::text AS legacy_certificado_id,
    created_at,
    updated_at
  FROM fiscal.certificate_vault
`;

export async function resolveOrganizationIdForTenant(
  db: Pool | PoolClient,
  automacaoTenantId: string
): Promise<string | null> {
  const org = await getOrganizationByAutomacaoTenantId(db, automacaoTenantId);
  return org?.id ?? null;
}

export async function revokeActiveVaultCertsForCliente(
  client: PoolClient,
  automacaoTenantId: string,
  portalClienteId: string
): Promise<void> {
  await client.query(
    `UPDATE fiscal.certificate_vault
     SET status = 'revoked', updated_at = now()
     WHERE automacao_tenant_id = $1
       AND portal_cliente_id = $2::uuid
       AND status IN ('active', 'expiring')`,
    [automacaoTenantId, portalClienteId]
  );
}

export async function insertCertificateVault(
  client: PoolClient,
  input: {
    organizationId: string;
    automacaoTenantId: string;
    portalClienteId: string;
    label: string;
    validFrom: string;
    validUntil: string;
    certificadoPem: string;
    chavePrivadaPem: string;
    uploadedByUserId?: string;
    ownerType?: "empresa" | "escritorio" | "exeq";
    legacyCertificadoId?: string;
  }
): Promise<CertificateVaultRow> {
  const enc = encryptCertificadoBundle(input.certificadoPem, input.chavePrivadaPem);
  const status = computeCertificateVaultStatus(input.validUntil);

  await revokeActiveVaultCertsForCliente(client, input.automacaoTenantId, input.portalClienteId);

  const r = await client.query<CertificateVaultRow>(
    `INSERT INTO fiscal.certificate_vault (
       organization_id, automacao_tenant_id, portal_cliente_id, owner_type,
       label, cert_encrypted, key_encrypted, encryption_iv,
       valid_from, valid_until, status, legacy_certificado_id, uploaded_by_user_id
     ) VALUES (
       $1::uuid, $2, $3::uuid, $4,
       $5, $6, $7, $8,
       $9::date, $10::date, $11, $12::uuid, $13::uuid
     )
     RETURNING
       id::text AS id,
       organization_id::text AS organization_id,
       automacao_tenant_id,
       portal_cliente_id::text AS portal_cliente_id,
       owner_type,
       label,
       valid_from::text AS valid_from,
       valid_until::text AS valid_until,
       status,
       legacy_certificado_id::text AS legacy_certificado_id,
       created_at,
       updated_at`,
    [
      input.organizationId,
      input.automacaoTenantId,
      input.portalClienteId,
      input.ownerType ?? "empresa",
      input.label,
      enc.cert_encrypted,
      enc.key_encrypted,
      enc.encryption_iv,
      input.validFrom,
      input.validUntil,
      status,
      input.legacyCertificadoId ?? null,
      input.uploadedByUserId ?? null
    ]
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error("Falha ao inserir certificate_vault.");
  }
  return mapMetaRow(row);
}

export async function getActiveVaultCertMetaForCliente(
  automacaoTenantId: string,
  portalClienteId: string,
  db: Pool | PoolClient
): Promise<CertificateVaultRow | null> {
  try {
    const r = await db.query<CertificateVaultRow>(
      `${SELECT_META}
       WHERE automacao_tenant_id = $1
         AND portal_cliente_id = $2::uuid
         AND status IN ('active', 'expiring')
         AND valid_until >= CURRENT_DATE
       ORDER BY valid_until DESC, created_at DESC
       LIMIT 1`,
      [automacaoTenantId, portalClienteId]
    );
    const row = r.rows[0];
    return row ? mapMetaRow(row) : null;
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
  }
}

export async function getActiveVaultCertForCliente(
  automacaoTenantId: string,
  portalClienteId: string,
  db: Pool | PoolClient
): Promise<(CertificateVaultRow & { decrypted: DecryptedCertificadoPem }) | null> {
  try {
    const r = await db.query<
      CertificateVaultRow & {
        cert_encrypted: string;
        key_encrypted: string;
        encryption_iv: string;
      }
    >(
      `SELECT
         id::text AS id,
         organization_id::text AS organization_id,
         automacao_tenant_id,
         portal_cliente_id::text AS portal_cliente_id,
         owner_type,
         label,
         valid_from::text AS valid_from,
         valid_until::text AS valid_until,
         status,
         legacy_certificado_id::text AS legacy_certificado_id,
         created_at,
         updated_at,
         cert_encrypted,
         key_encrypted,
         encryption_iv
       FROM fiscal.certificate_vault
       WHERE automacao_tenant_id = $1
         AND portal_cliente_id = $2::uuid
         AND status IN ('active', 'expiring')
         AND valid_until >= CURRENT_DATE
       ORDER BY valid_until DESC, created_at DESC
       LIMIT 1`,
      [automacaoTenantId, portalClienteId]
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
    return { ...mapMetaRow(meta), decrypted };
  } catch (error: unknown) {
    rethrowFiscalSchemaError(error);
  }
}
