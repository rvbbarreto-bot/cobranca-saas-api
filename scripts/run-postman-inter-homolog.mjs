#!/usr/bin/env node
/**
 * Executa a collection Inter Gateway Homolog via Newman.
 * Secrets: postman/Inter_Gateway_Homolog.local.postman_environment.json (gitignored)
 * ou variáveis de ambiente INTER_CLIENT_ID, INTER_CLIENT_SECRET, INTER_CERTIFICATE_PEM, INTER_PRIVATE_KEY_PEM.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const collection = path.join(root, "postman/Inter_Gateway_Homolog.postman_collection.json");
const envDefault = path.join(root, "postman/Inter_Gateway_Homolog.postman_environment.json");
const envLocal = path.join(root, "postman/Inter_Gateway_Homolog.local.postman_environment.json");
const reportDir = path.join(root, "docs/evidencias");
const reportJson = path.join(reportDir, "postman-inter-homolog-report.json");

const smokeOnly = process.argv.includes("--smoke");
const folders = smokeOnly
  ? ["0 — Health", "1 — Auth", "2 — Gateway Inter (config)"]
  : null;

function ensureLocalEnv() {
  if (fs.existsSync(envLocal)) return envLocal;
  const id = process.env.INTER_CLIENT_ID?.trim();
  const secret = process.env.INTER_CLIENT_SECRET?.trim();
  if (!id || !secret) {
    console.error(
      "Ambiente local ausente. Crie postman/Inter_Gateway_Homolog.local.postman_environment.json " +
        "ou defina INTER_CLIENT_ID e INTER_CLIENT_SECRET."
    );
    process.exit(1);
  }
  const template = JSON.parse(fs.readFileSync(envDefault, "utf8"));
  for (const v of template.values) {
    if (v.key === "interClientId") v.value = id;
    if (v.key === "interClientSecret") v.value = secret;
    if (v.key === "interCertificatePem" && process.env.INTER_CERTIFICATE_PEM)
      v.value = process.env.INTER_CERTIFICATE_PEM;
    if (v.key === "interPrivateKeyPem" && process.env.INTER_PRIVATE_KEY_PEM)
      v.value = process.env.INTER_PRIVATE_KEY_PEM;
  }
  fs.writeFileSync(envLocal, JSON.stringify(template, null, 2), "utf8");
  console.log("Gerado:", envLocal);
  return envLocal;
}

function main() {
  if (!fs.existsSync(collection)) {
    console.error("Collection não encontrada:", collection);
    process.exit(1);
  }
  fs.mkdirSync(reportDir, { recursive: true });
  const envFile = ensureLocalEnv();

  const baseUrl = process.env.POSTMAN_BASE_URL?.trim() || "http://localhost:3333";
  console.log("baseUrl:", baseUrl);

  const args = [
    "newman",
    "run",
    collection,
    "-e",
    envFile,
    "--env-var",
    `baseUrl=${baseUrl}`,
    "--reporters",
    "cli,json",
    "--reporter-json-export",
    reportJson,
    "--timeout-request",
    "60000"
  ];
  if (!smokeOnly) {
    args.push("--delay-request", "2000");
  }

  if (folders) {
    for (const f of folders) {
      args.push("--folder", f);
    }
  }

  console.log(smokeOnly ? "Modo: smoke (pastas 0–2)" : "Modo: suite completa");
  try {
    execSync(`npx ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`, {
      cwd: root,
      stdio: "inherit",
      shell: true
    });
    console.log("\nRelatório JSON:", reportJson);
  } catch {
    console.error("\nNewman terminou com falhas. Ver relatório:", reportJson);
    process.exit(1);
  }
}

main();
