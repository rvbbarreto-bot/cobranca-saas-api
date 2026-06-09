/**
 * Smoke E2E — POST /v1/portal/certificates/validate + PATCH gateway (LLD-CERT-001).
 * Uso: npx tsx scripts/cert-upload-e2e-smoke.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const apiBase = process.env.API_BASE_URL?.trim() || "http://localhost:3333";
const email = process.env.PORTAL_LOGIN_EMAIL?.trim() || "admin@teste.local";
const password = process.env.PORTAL_LOGIN_PASSWORD?.trim() || "TesteDev!2026";
const tenantSlug = process.env.PORTAL_TENANT_SLUG?.trim() || "escritorio-demo";

const fixturesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../tests/fixtures");
const certPath = path.join(fixturesDir, "test-mtls.crt");
const keyPath = path.join(fixturesDir, "test-mtls.key");

async function main(): Promise<void> {
  const loginRes = await fetch(`${apiBase}/v1/portal/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, tenant_id: tenantSlug })
  });
  const loginJson = (await loginRes.json()) as {
    access_token?: string;
    message?: string;
    login_kind?: string;
    tenants?: Array<{ automacao_tenant_id: string; slug: string }>;
  };
  if (!loginRes.ok || !loginJson.access_token) {
    throw new Error(`Login falhou (${loginRes.status}): ${JSON.stringify(loginJson)}`);
  }

  const token = loginJson.access_token;
  const tenantHeader = tenantSlug;

  const form = new FormData();
  form.append("certificate", new Blob([fs.readFileSync(certPath)]), "cert.crt");
  form.append("private_key", new Blob([fs.readFileSync(keyPath)]), "key.key");

  const validateRes = await fetch(`${apiBase}/v1/portal/certificates/validate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": tenantHeader
    },
    body: form
  });
  const validateText = await validateRes.text();
  let validateJson: unknown;
  try {
    validateJson = JSON.parse(validateText);
  } catch {
    validateJson = validateText;
  }

  if (!validateRes.ok) {
    throw new Error(`Validate falhou (${validateRes.status}): ${validateText}`);
  }

  const validated = validateJson as {
    certificate_id: string;
    subject_cn: string;
    not_after: string;
  };
  console.log("✓ POST /v1/portal/certificates/validate", {
    status: validateRes.status,
    certificate_id: validated.certificate_id,
    subject_cn: validated.subject_cn,
    not_after: validated.not_after
  });

  if (JSON.stringify(validateJson).includes("BEGIN PRIVATE KEY")) {
    throw new Error("SEG-07 violado: resposta contém PEM");
  }

  const patchRes = await fetch(`${apiBase}/v1/portal/escritorio/gateway`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": tenantHeader,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      gateway_provider: "inter",
      gateway_credentials: {
        client_id: process.env.QA_INTER_CLIENT_ID?.trim() || "00000000-0000-4000-8000-000000000099",
        client_secret: process.env.QA_INTER_CLIENT_SECRET?.trim() || "test-inter-client-secret-local"
      },
      certificate_upload_id: validated.certificate_id
    })
  });
  const patchText = await patchRes.text();
  let patchJson: unknown;
  try {
    patchJson = JSON.parse(patchText);
  } catch {
    patchJson = patchText;
  }

  if (!patchRes.ok) {
    throw new Error(`PATCH gateway falhou (${patchRes.status}): ${patchText}`);
  }

  const config = (patchJson as { config?: { gateway_provider?: string; gateway_credentials_configured?: boolean } })
    .config;
  console.log("✓ PATCH /v1/portal/escritorio/gateway", {
    status: patchRes.status,
    gateway_provider: config?.gateway_provider,
    gateway_credentials_configured: config?.gateway_credentials_configured
  });

  const evidence = {
    run_at: new Date().toISOString(),
    api_base: apiBase,
    tenant: tenantSlug,
    validate: validateJson,
    gateway_patch_status: patchRes.status,
    gateway_provider: config?.gateway_provider
  };
  const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../docs/evidencias");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(
    outDir,
    `cert-upload-e2e-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  fs.writeFileSync(outFile, JSON.stringify(evidence, null, 2));
  console.log(`Evidência: ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
