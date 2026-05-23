#!/usr/bin/env node
/**
 * Cria postman/Inter_Gateway_Homolog.local.postman_environment.json (gitignored)
 * a partir do template + variáveis de ambiente (não commitar secrets).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templatePath = path.join(root, "postman/Inter_Gateway_Homolog.postman_environment.json");
const outPath = path.join(root, "postman/Inter_Gateway_Homolog.local.postman_environment.json");

const map = {
  interClientId: process.env.INTER_CLIENT_ID,
  interClientSecret: process.env.INTER_CLIENT_SECRET,
  interCertificatePem: process.env.INTER_CERTIFICATE_PEM,
  interPrivateKeyPem: process.env.INTER_PRIVATE_KEY_PEM,
  baseUrl: process.env.POSTMAN_BASE_URL
};

if (!fs.existsSync(templatePath)) {
  console.error("Template ausente:", templatePath);
  process.exit(1);
}

const env = JSON.parse(fs.readFileSync(templatePath, "utf8"));
env.name = "Inter Gateway Homolog — Local (secrets)";

for (const v of env.values) {
  const val = map[v.key];
  if (val) v.value = val;
}

const cert = (map.interCertificatePem || "").trim();
const key = (map.interPrivateKeyPem || "").trim();
const pemOk = cert.includes("BEGIN CERTIFICATE") && key.includes("BEGIN");
for (const v of env.values) {
  if (v.key === "pemConfigured") v.value = pemOk ? "true" : "false";
}

fs.writeFileSync(outPath, JSON.stringify(env, null, 2), "utf8");
console.log("OK:", outPath);
console.log("pemConfigured:", pemOk ? "true" : "false (emissão pasta 3 será ignorada)");
