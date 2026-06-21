/**
 * Grava gateway Inter via API (homolog) — secrets só por env, nunca no git.
 *
 * Uso:
 *   $env:QA_INTER_CLIENT_ID="..."
 *   $env:QA_INTER_CLIENT_SECRET="..."
 *   npm run qa:inter-push-gateway
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizePemPaste } from "../src/platform/payment-gateway/mtls-credential-validation.js";
import { validateInterCredentialAppAlignment } from "../src/platform/payment-gateway/inter-credential-alignment.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiBase = (process.env.QA_API_BASE_URL ?? "http://localhost:3333").replace(/\/$/, "");

async function main(): Promise<void> {
  const clientId = process.env.QA_INTER_CLIENT_ID?.trim();
  const clientSecret = process.env.QA_INTER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Defina QA_INTER_CLIENT_ID e QA_INTER_CLIENT_SECRET no ambiente.");
  }

  const certPath = path.join(repoRoot, "data", "qa-inter-credentials", "certificate.pem");
  const keyPath = path.join(repoRoot, "data", "qa-inter-credentials", "private_key.pem");
  const certificatePem = sanitizePemPaste(fs.readFileSync(certPath, "utf8"));
  const privateKeyPem = sanitizePemPaste(fs.readFileSync(keyPath, "utf8"));

  const alignment = validateInterCredentialAppAlignment(clientId, certificatePem);
  if (!alignment.ok) {
    throw new Error(
      `[qa-inter-push-gateway] ${alignment.message}\n` +
        "Corrija QA_INTER_CLIENT_ID para o OU do certificado ou baixe novo pacote mTLS no Portal Inter."
    );
  }

  const email = process.env.QA_PORTAL_EMAIL ?? "admin@teste.local";
  const tenantSlug = process.env.QA_PORTAL_TENANT ?? "escritorio-demo";
  const password = process.env.QA_PORTAL_PASSWORD ?? "TesteDev!2026";

  const loginRes = await fetch(`${apiBase}/v1/portal/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, tenant_id: tenantSlug, password })
  });
  const login = (await loginRes.json()) as {
    access_token?: string;
    tenant_id?: string;
    error?: string;
  };
  if (!loginRes.ok || !login.access_token || !login.tenant_id) {
    throw new Error(`Login falhou: ${JSON.stringify(login)}`);
  }

  const patchBody = {
    gateway_provider: "inter",
    gateway_credentials: {
      client_id: clientId,
      client_secret: clientSecret,
      certificate_pem: certificatePem,
      private_key_pem: privateKeyPem
    }
  };

  const patchRes = await fetch(`${apiBase}/v1/portal/escritorio/gateway`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${login.access_token}`,
      "x-tenant-id": login.tenant_id
    },
    body: JSON.stringify(patchBody)
  });
  const patch = await patchRes.json();
  if (!patchRes.ok) {
    throw new Error(`PATCH gateway falhou (${patchRes.status}): ${JSON.stringify(patch)}`);
  }

  const cfg = patch as {
    config?: { gateway_provider?: string; gateway_credentials_configured?: boolean };
  };
  console.log("[qa-inter-push-gateway] OK");
  console.log(`  provider=${cfg.config?.gateway_provider}`);
  console.log(`  credentials_configured=${cfg.config?.gateway_credentials_configured}`);
}

main().catch((e) => {
  console.error("[qa-inter-push-gateway]", e instanceof Error ? e.message : e);
  process.exit(1);
});
