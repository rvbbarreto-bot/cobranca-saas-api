/**
 * Regrava certificado A1 EXEQ no vault com ENCRYPTION_KEY atual (piloto ricardo).
 *
 * Uso (paths locais — nunca commitar PEM):
 *   FISC_021_CERT_PEM_FILE=C:\certs\exeq.crt.pem
 *   FISC_021_KEY_PEM_FILE=C:\certs\exeq.key.pem
 *   npx tsx scripts/fisc-021-sync-cert-ricardo.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { postPortalCertificadoDigitalUseCase } from "../src/modules/fiscal-guias/application/post-portal-certificado-digital";
import { getActiveCertificadoForCliente } from "../src/modules/fiscal-guias/infrastructure/certificado-digital-repository";
import { closePool } from "../src/platform/persistence/pool";

const TENANT_ID = "8";
const PORTAL_CLIENTE_ID = "64219e1e-8488-4d9a-8d9f-b3a902835d1d";

function readPem(path: string | undefined, label: string): string {
  if (!path?.trim()) {
    throw new Error(`${label} ausente — defina FISC_021_CERT_PEM_FILE e FISC_021_KEY_PEM_FILE.`);
  }
  return readFileSync(path.trim(), "utf8");
}

async function main(): Promise<void> {
  if (!process.env.ENCRYPTION_KEY?.trim()) {
    throw new Error("ENCRYPTION_KEY ausente no .env");
  }

  const certPem = readPem(process.env.FISC_021_CERT_PEM_FILE, "FISC_021_CERT_PEM_FILE");
  const keyPem = readPem(process.env.FISC_021_KEY_PEM_FILE, "FISC_021_KEY_PEM_FILE");

  const result = await postPortalCertificadoDigitalUseCase({
    tenantId: TENANT_ID,
    body: {
      portal_cliente_id: PORTAL_CLIENTE_ID,
      label: "Certificado A1 EXEQ (FISC-021 sync)",
      valid_from: "2025-01-01",
      valid_until: "2026-09-05",
      certificado_pem: certPem,
      chave_privada_pem: keyPem
    }
  });

  if (!result.ok) {
    console.error("Falha ao gravar certificado:", result);
    process.exit(1);
  }

  const decrypted = await getActiveCertificadoForCliente(TENANT_ID, PORTAL_CLIENTE_ID);
  console.log("Certificado regravado OK:", {
    id: result.certificado.id,
    label: result.certificado.label,
    decrypt_ok: Boolean(decrypted?.decrypted.certificadoPem)
  });
  await closePool();
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
