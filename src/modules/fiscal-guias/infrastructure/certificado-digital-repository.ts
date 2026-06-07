import type { Pool, PoolClient } from "pg";
import { decryptAes256Gcm, encryptAes256Gcm } from "../../../platform/crypto/symmetric-encryption";
import { getPool } from "../../../platform/persistence/pool";
import { rethrowFiscalSchemaError } from "./fiscal-schema";

const BUNDLE_MARKER = "__bundled__";

export type CertificadoDigitalRow = {
  id: string;
  portal_cliente_id: string;
  label: string;
  valid_from: string;
  valid_until: string;
  ativo: boolean;
  created_at: Date;
  updated_at: Date;
};

export type DecryptedCertificadoPem = {
  certificadoPem: string;
  chavePrivadaPem: string;
};

function encryptCertificadoBundle(certificadoPem: string, chavePrivadaPem: string): {
  cert_encrypted: string;
  key_encrypted: string;
  encryption_iv: string;
} {
  const payload = JSON.stringify({ cert: certificadoPem, key: chavePrivadaPem });
  const { ciphertext, iv } = encryptAes256Gcm(payload);
  return {
    cert_encrypted: ciphertext,
    key_encrypted: BUNDLE_MARKER,
    encryption_iv: iv
  };
}

function decryptCertificadoBundle(
  certEncrypted: string,
  keyEncrypted: string,
  iv: string
): DecryptedCertificadoPem {
  if (keyEncrypted === BUNDLE_MARKER) {
    const json = decryptAes256Gcm(certEncrypted, iv);
    const parsed = JSON.parse(json) as { cert?: string; key?: string };
    if (!parsed.cert?.trim() || !parsed.key?.trim()) {
      throw new Error("Bundle certificado invalido.");
    }
    return { certificadoPem: parsed.cert, chavePrivadaPem: parsed.key };
  }
  return {
    certificadoPem: decryptAes256Gcm(certEncrypted, iv),
    chavePrivadaPem: decryptAes256Gcm(keyEncrypted, iv)
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
  const enc = encryptCertificadoBundle(input.certificadoPem, input.chavePrivadaPem);

  await client.query(
    `UPDATE fiscal.certificado_digital
     SET ativo = false, updated_at = now()
     WHERE tenant_id = $1 AND portal_cliente_id = $2::uuid AND ativo = true`,
    [input.tenantId, input.portalClienteId]
  );

  const r = await client.query<CertificadoDigitalRow>(
    `INSERT INTO fiscal.certificado_digital (
       tenant_id, portal_cliente_id, label, valid_from, valid_until,
       cert_encrypted, key_encrypted, encryption_iv, uploaded_by_user_id, ativo
     )
     VALUES ($1, $2::uuid, $3, $4::date, $5::date, $6, $7, $8, $9::uuid, true)
     RETURNING
       id::text AS id,
       portal_cliente_id::text AS portal_cliente_id,
       label,
       valid_from::text AS valid_from,
       valid_until::text AS valid_until,
       ativo,
       created_at,
       updated_at`,
    [
      input.tenantId,
      input.portalClienteId,
      input.label,
      input.validFrom,
      input.validUntil,
      enc.cert_encrypted,
      enc.key_encrypted,
      enc.encryption_iv,
      input.uploadedByUserId ?? null
    ]
  );
  const row = r.rows[0];
  if (!row) {
    throw new Error("Falha ao inserir certificado digital.");
  }
  return row;
}

/** Metadados do certificado ativo (sem PEM) — uso portal GET. */
export async function getActiveCertificadoMetaForCliente(
  tenantId: string,
  portalClienteId: string,
  db: Pool | PoolClient = getPool()
): Promise<CertificadoDigitalRow | null> {
  try {
    const r = await db.query<CertificadoDigitalRow>(
      `SELECT
         id::text AS id,
         portal_cliente_id::text AS portal_cliente_id,
         label,
         valid_from::text AS valid_from,
         valid_until::text AS valid_until,
         ativo,
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
