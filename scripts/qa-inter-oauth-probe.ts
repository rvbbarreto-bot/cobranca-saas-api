/**
 * Diagnóstico OAuth mTLS Inter — credenciais gravadas vs pacote QA.
 * Uso: npx tsx scripts/qa-inter-oauth-probe.ts
 *
 * Variáveis: DATABASE_URL, ENCRYPTION_KEY (do .env local)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { createHash, X509Certificate } from "node:crypto";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { decrypt } from "../src/platform/crypto/decrypt.js";
import { buildMtlsAgent } from "../src/platform/payment-gateway/mtls-agent.js";
import { getInterAccessToken } from "../src/modules/payment-gateway/infrastructure/inter/inter-oauth.js";
import type { GatewayCredentials } from "../src/modules/payment-gateway/domain/gateway-types.js";
import { sanitizePemPaste } from "../src/platform/payment-gateway/mtls-credential-validation.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_TENANT = "00000000-0000-4000-8000-000000000001";
const qaCertPath = path.join(repoRoot, "data", "qa-inter-credentials", "certificate.pem");
const qaKeyPath = path.join(repoRoot, "data", "qa-inter-credentials", "private_key.pem");

function certFingerprint(pem: string): string {
  try {
    const cert = new X509Certificate(sanitizePemPaste(pem));
    return createHash("sha256").update(cert.raw).digest("hex").slice(0, 16);
  } catch {
    return "invalid";
  }
}

function certSummary(pem: string): string {
  try {
    const cert = new X509Certificate(sanitizePemPaste(pem));
    const cn = cert.subject.split("\n").find((l) => l.startsWith("CN=")) ?? cert.subject;
    return `${cn} | valid ${cert.validFrom} → ${cert.validTo}`;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

async function loadStoredCredentials(): Promise<GatewayCredentials & { updated_at?: string }> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("Defina DATABASE_URL no .env");
  }
  const pool = new pg.Pool({ connectionString: url });
  try {
    const r = await pool.query<{
      gateway_credentials_encrypted: string | null;
      encryption_iv: string | null;
      updated_at: string;
    }>(
      `SELECT gateway_credentials_encrypted, encryption_iv, updated_at::text
       FROM escritorio_config WHERE tenant_id = $1 LIMIT 1`,
      [PUBLIC_TENANT]
    );
    const row = r.rows[0];
    if (!row?.gateway_credentials_encrypted?.trim() || !row.encryption_iv?.trim()) {
      throw new Error("escritorio_config sem gateway_credentials_encrypted");
    }
    const json = decrypt(row.gateway_credentials_encrypted.trim(), row.encryption_iv.trim());
    const creds = JSON.parse(json) as GatewayCredentials;
    return { ...creds, updated_at: row.updated_at };
  } finally {
    await pool.end();
  }
}

async function main(): Promise<void> {
  console.log("\n=== QA Inter OAuth Probe ===\n");

  const stored = await loadStoredCredentials();
  const storedCert = stored.certificate_pem ?? "";
  const storedKey = stored.private_key_pem ?? "";

  console.log(`DB updated_at: ${stored.updated_at ?? "?"}`);
  console.log(`client_id: ${stored.client_id ? `${stored.client_id.slice(0, 8)}…` : "(ausente)"}`);
  console.log(`client_secret: ${stored.client_secret ? "*** configurado" : "(ausente)"}`);

  try {
    const cert = new X509Certificate(sanitizePemPaste(storedCert));
    const ou = cert.subject.split("\n").find((l) => l.startsWith("OU="))?.slice(3);
    if (ou && stored.client_id && ou !== stored.client_id) {
      console.log(
        `\n⚠ Integração no certificado (OU=${ou}) ≠ client_id (${stored.client_id}).`
      );
      console.log("   Inter exige certificado emitido para a MESMA aplicação do client_id.");
    }
  } catch {
    /* ignore */
  }

  console.log(`\nCertificado gravado: ${certSummary(storedCert)}`);
  console.log(`Fingerprint DB:  ${certFingerprint(storedCert)}`);

  if (fs.existsSync(qaCertPath)) {
    const qaCert = fs.readFileSync(qaCertPath, "utf8");
    console.log(`\nPacote QA local:   ${certSummary(qaCert)}`);
    console.log(`Fingerprint QA:    ${certFingerprint(qaCert)}`);
    const match = certFingerprint(storedCert) === certFingerprint(qaCert);
    console.log(`\nCert DB == QA:     ${match ? "SIM" : "NAO — regravar PEM do pacote QA"}`);
  }

  const agent = buildMtlsAgent({ certPem: storedCert, keyPem: storedKey });
  const ctx = {
    tenantId: PUBLIC_TENANT,
    provider: "inter",
    credentials: stored,
    sandbox: process.env.GATEWAY_INTER_SANDBOX?.trim()
      ? ["true", "1"].includes(process.env.GATEWAY_INTER_SANDBOX.trim().toLowerCase())
      : true
  };

  console.log("\nTestando OAuth sandbox Inter…");
  try {
    const token = await getInterAccessToken(ctx, agent);
    console.log(`\n✓ OAuth OK — access_token (${token.length} chars)`);
    process.exit(0);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`\n✗ OAuth FALHOU: ${msg}`);
    if (/unknown ca|alert number 48/i.test(msg)) {
      console.error("\nAção: certificado não aceito pelo Inter — usar par da mesma app que client_id/secret.");
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
