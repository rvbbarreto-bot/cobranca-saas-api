/**
 * Restaura integracao Inter homolog (PO autorizado): PEM local → reset → push → oauth probe → bateria.
 *
 * Uso:
 *   $env:INTER_PEM_SOURCE_DIR="C:\...\Inter_API-Chave_e_Certificado"
 *   $env:QA_INTER_CLIENT_ID="..."
 *   $env:QA_INTER_CLIENT_SECRET="..."
 *   $env:GATEWAY_INTER_SANDBOX="true"
 *   npm run qa:inter-restore
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractIntegrationIdFromInterCert } from "../src/platform/payment-gateway/inter-credential-alignment.js";
import { sanitizePemPaste } from "../src/platform/payment-gateway/mtls-credential-validation.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function runNpm(script: string, extraEnv: Record<string, string> = {}): void {
  const result = spawnSync(process.platform === "win32" ? "npm.cmd" : "npm", ["run", script], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ...extraEnv }
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function assertPemSource(): void {
  const source =
    process.env.INTER_PEM_SOURCE_DIR?.trim() ||
    "C:\\Projeto\\Inter_API-Chave_e_Certificado";
  const certNames = ["Inter API_Certificado.crt", "Inter API_Certificado.pem", "certificate.pem"];
  const found = certNames.find((name) => fs.existsSync(path.join(source, name)));
  if (!found) {
    throw new Error(
      `Certificado Inter nao encontrado em INTER_PEM_SOURCE_DIR=${source}. ` +
        "Defina a pasta com Inter API_Certificado.crt e Inter API_Chave.key."
    );
  }
}

function assertClientIdMatchesCert(): void {
  const clientId = process.env.QA_INTER_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("Defina QA_INTER_CLIENT_ID antes de qa:inter-restore.");
  }
  const certPath = path.join(repoRoot, "data", "qa-inter-credentials", "certificate.pem");
  if (!fs.existsSync(certPath)) {
    throw new Error("Pacote PEM ausente — etapa qa:inter-pem falhou.");
  }
  const certPem = sanitizePemPaste(fs.readFileSync(certPath, "utf8"));
  const ou = extractIntegrationIdFromInterCert(certPem);
  if (ou && ou !== clientId.toLowerCase()) {
    throw new Error(
      `Client ID (${clientId}) ≠ OU do certificado (${ou}). ` +
        "Baixe certificado+chave da mesma app no Portal Developers ou ajuste QA_INTER_CLIENT_ID."
    );
  }
}

async function main(): Promise<void> {
  console.log("\n=== QA Inter — restore homolog ===\n");

  if (!process.env.QA_INTER_CLIENT_SECRET?.trim()) {
    throw new Error("Defina QA_INTER_CLIENT_SECRET.");
  }

  if (!process.env.GATEWAY_INTER_SANDBOX?.trim()) {
    process.env.GATEWAY_INTER_SANDBOX = "true";
    console.log("[restore] GATEWAY_INTER_SANDBOX=true (default homolog)");
  }

  assertPemSource();
  runNpm("qa:inter-pem");
  assertClientIdMatchesCert();
  runNpm("qa:inter-reset-credentials");
  runNpm("qa:inter-push-gateway");
  runNpm("qa:inter-oauth-probe");
  runNpm("qa:inter-api");

  console.log("\n[restore] Integracao Inter homolog concluida.\n");
}

main().catch((e) => {
  console.error("[qa-inter-restore]", e instanceof Error ? e.message : e);
  process.exit(1);
});
