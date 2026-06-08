/**
 * Confere se o OU do certificado Inter = client_id esperado.
 *
 * Uso (arquivo .crt):
 *   npm run qa:inter-check-cert-ou -- "C:\path\Inter API_Certificado.crt"
 *
 * Uso (pasta com arquivos Inter):
 *   npm run qa:inter-check-cert-ou -- "C:\path\Inter_API-Chave_e_Certificado"
 */
import fs from "node:fs";
import path from "node:path";
import { X509Certificate } from "node:crypto";
import { extractIntegrationIdFromInterCert } from "../src/platform/payment-gateway/inter-credential-alignment.js";

const INTER_CERT_NAMES = [
  "Inter API_Certificado.crt",
  "Inter API_Certificado.pem",
  "certificate.pem",
  "certificado.crt"
];

function resolveCertPath(input: string): string {
  const resolved = path.resolve(input);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Caminho nao encontrado: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (stat.isFile()) {
    return resolved;
  }

  if (!stat.isDirectory()) {
    throw new Error(`Caminho invalido: ${resolved}`);
  }

  for (const name of INTER_CERT_NAMES) {
    const candidate = path.join(resolved, name);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  const files = fs.readdirSync(resolved).filter((f) => /\.(crt|pem)$/i.test(f));
  if (files.length === 1) {
    return path.join(resolved, files[0]!);
  }

  throw new Error(
    `Pasta informada, mas certificado nao encontrado.\n` +
      `  Pasta: ${resolved}\n` +
      `  Procure por: ${INTER_CERT_NAMES.join(" ou ")}\n` +
      `  Ou passe o caminho completo do .crt:\n` +
      `  npm run qa:inter-check-cert-ou -- "${path.join(resolved, "Inter API_Certificado.crt")}"`
  );
}

const inputPath = process.argv[2]?.trim();
const expectedClientId = (process.argv[3] ?? "4b8fb3b0-7c8e-4e28-a0fa-cf5cee8ceed2").trim().toLowerCase();

if (!inputPath) {
  console.error(
    "Uso: npm run qa:inter-check-cert-ou -- <arquivo.crt OU pasta>\n" +
      "Ex.: npm run qa:inter-check-cert-ou -- \"C:\\Certificado\\Inter_API-Chave_e_Certificado\""
  );
  process.exit(1);
}

let certPath: string;
try {
  certPath = resolveCertPath(inputPath);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}

const pem = fs.readFileSync(certPath, "utf8");
const cert = new X509Certificate(pem);
const cn = cert.subject.split("\n").find((l) => l.startsWith("CN="))?.slice(3);
const ou = extractIntegrationIdFromInterCert(pem);
const ok = ou === expectedClientId;

console.log("\n=== Conferencia certificado Inter ===\n");
console.log(`Entrada:  ${path.resolve(inputPath)}`);
console.log(`Arquivo:  ${certPath}`);
console.log(`CN (empresa):     ${cn ?? "(nao encontrado)"}`);
console.log(`OU (integracao):  ${ou ?? "(nao encontrado — cert pode nao ser Inter API)"}`);
console.log(`Client ID esperado: ${expectedClientId}`);
console.log(`Validade: ${cert.validFrom} -> ${cert.validTo}`);
console.log(`\nResultado: ${ok ? "OK — pode usar este cert com esse client_id" : "FALHA — certificado e client_id sao de apps diferentes"}\n`);

process.exit(ok ? 0 : 1);
