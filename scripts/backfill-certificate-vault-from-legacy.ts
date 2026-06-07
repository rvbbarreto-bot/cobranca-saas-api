/**
 * Backfill fiscal.certificate_vault a partir de fiscal.certificado_digital (EXEQ-FISC-021).
 * Idempotente — usa legacy_certificado_id UNIQUE.
 *
 * Uso: npm run backfill:certificate-vault
 */
import "dotenv/config";
import pg from "pg";
import { decryptCertificadoBundle } from "../src/modules/fiscal-guias/infrastructure/certificate-pem-crypto";
import { insertCertificateVault } from "../src/modules/fiscal-guias/infrastructure/certificate-vault-repository";
import { getOrganizationByAutomacaoTenantId } from "../src/modules/exeq-platform/infrastructure/organization-repository";

async function main() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("DATABASE_URL obrigatório.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  try {
    const check = await client.query<{ ok: boolean }>(
      `SELECT to_regclass('fiscal.certificate_vault') IS NOT NULL AS ok`
    );
    if (!check.rows[0]?.ok) {
      console.error("Execute npm run migrate (033_certificate_vault.sql) primeiro.");
      process.exit(1);
    }

    const legacy = await client.query<{
      id: string;
      tenant_id: string;
      portal_cliente_id: string;
      label: string;
      valid_from: string;
      valid_until: string;
      cert_encrypted: string;
      key_encrypted: string;
      encryption_iv: string;
      uploaded_by_user_id: string | null;
    }>(
      `SELECT
         id::text AS id,
         tenant_id,
         portal_cliente_id::text AS portal_cliente_id,
         label,
         valid_from::text AS valid_from,
         valid_until::text AS valid_until,
         cert_encrypted,
         key_encrypted,
         encryption_iv,
         uploaded_by_user_id::text AS uploaded_by_user_id
       FROM fiscal.certificado_digital
       WHERE ativo = true
       ORDER BY tenant_id, portal_cliente_id, valid_until DESC, created_at DESC`
    );

    const seen = new Set<string>();
    let migrated = 0;
    let skipped = 0;

    for (const row of legacy.rows) {
      const dedupeKey = `${row.tenant_id}:${row.portal_cliente_id}`;
      if (seen.has(dedupeKey)) {
        skipped++;
        continue;
      }
      seen.add(dedupeKey);
      const exists = await client.query<{ ok: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM fiscal.certificate_vault WHERE legacy_certificado_id = $1::uuid
         ) AS ok`,
        [row.id]
      );
      if (exists.rows[0]?.ok) {
        skipped++;
        continue;
      }

      const org = await getOrganizationByAutomacaoTenantId(client, row.tenant_id);
      if (!org) {
        console.warn(`[backfill] tenant ${row.tenant_id} sem org — cert ${row.id} ignorado.`);
        skipped++;
        continue;
      }

      const newerVault = await client.query(
        `SELECT 1 FROM fiscal.certificate_vault
         WHERE automacao_tenant_id = $1 AND portal_cliente_id = $2::uuid
           AND status IN ('active', 'expiring')
         LIMIT 1`,
        [row.tenant_id, row.portal_cliente_id]
      );
      if ((newerVault.rowCount ?? 0) > 0) {
        skipped++;
        continue;
      }

      let decrypted;
      try {
        decrypted = decryptCertificadoBundle(
          row.cert_encrypted,
          row.key_encrypted,
          row.encryption_iv
        );
      } catch {
        console.warn(
          `[backfill] cert ${row.id} nao descriptografado (ENCRYPTION_KEY ou formato legado) — ignorado.`
        );
        skipped++;
        continue;
      }

      await insertCertificateVault(client, {
        organizationId: org.id,
        automacaoTenantId: row.tenant_id,
        portalClienteId: row.portal_cliente_id,
        label: row.label,
        validFrom: row.valid_from,
        validUntil: row.valid_until,
        certificadoPem: decrypted.certificadoPem,
        chavePrivadaPem: decrypted.chavePrivadaPem,
        uploadedByUserId: row.uploaded_by_user_id ?? undefined,
        legacyCertificadoId: row.id
      });
      migrated++;
    }

    console.log(
      `Backfill certificate_vault OK — legado ativos: ${legacy.rowCount}, migrados: ${migrated}, ignorados: ${skipped}`
    );
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
