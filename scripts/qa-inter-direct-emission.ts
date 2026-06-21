/**
 * Emissão direta Inter (sem API local) — valida OAuth + POST /cobrancas/v2.
 * Uso: QA_INTER_CLIENT_ID=... QA_INTER_CLIENT_SECRET=... npx tsx scripts/qa-inter-direct-emission.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMtlsAgent } from "../src/platform/payment-gateway/mtls-agent.js";
import { sanitizePemPaste } from "../src/platform/payment-gateway/mtls-credential-validation.js";
import { InterAdapter } from "../src/modules/payment-gateway/infrastructure/inter/inter-adapter.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultCertDir =
  "c:\\Users\\riica\\OneDrive\\Empresas Ricardo\\Exeq\\Projeto_CobrancaBoleto_v2\\Certificado\\Sandbox\\Inter_API-Chave_e_Certificado (1)";

function readPem(): { cert: string; key: string } {
  const certPath =
    process.env.INTER_CERT_PATH?.trim() ||
    path.join(defaultCertDir, "Sandbox_InterAPI_Certificado.crt");
  const keyPath =
    process.env.INTER_KEY_PATH?.trim() ||
    path.join(defaultCertDir, "Sandbox_InterAPI_Chave.key");
  return {
    cert: sanitizePemPaste(fs.readFileSync(certPath, "utf8")),
    key: sanitizePemPaste(fs.readFileSync(keyPath, "utf8"))
  };
}

async function main(): Promise<void> {
  const clientId = process.env.QA_INTER_CLIENT_ID?.trim() || process.env.INTER_CLIENT_ID?.trim();
  const clientSecret =
    process.env.QA_INTER_CLIENT_SECRET?.trim() || process.env.INTER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("Defina QA_INTER_CLIENT_ID e QA_INTER_CLIENT_SECRET.");
  }

  const { cert, key } = readPem();
  const adapter = new InterAdapter({
    tenantId: "qa-direct-emission",
    provider: "inter",
    sandbox: true,
    credentials: {
      client_id: clientId,
      client_secret: clientSecret,
      certificate_pem: cert,
      private_key_pem: key
    }
  });

  const due = new Date();
  due.setUTCDate(due.getUTCDate() + 14);
  const dueDate = due.toISOString().slice(0, 10);

  const customerId = await adapter.createCustomer({
    name: "Cliente QA Inter",
    cpfCnpj: "39053344705",
    email: "qa.inter@test.local",
    phone: "11987654321",
    externalReference: "qa-direct"
  });

  console.log("\n=== QA Inter emissao direta ===\n");
  console.log(`client_id: ${clientId.slice(0, 8)}…`);
  console.log(`POST /cobrancas/v2 vencimento=${dueDate}\n`);

  try {
    const boleto = await adapter.createBoleto({
      gatewayCustomerId: customerId,
      value: 15.9,
      dueDate,
      description: "QA integracao Inter sandbox",
      externalReference: `qa-${Date.now()}`,
      payer: {
        name: "Cliente QA Inter",
        cpfCnpj: "39053344705",
        email: "qa.inter@test.local",
        phone: "11987654321",
        endereco: {
          cep: "01310100",
          logradouro: "Av Paulista",
          numero: "1000",
          bairro: "Bela Vista",
          cidade: "Sao Paulo",
          uf: "SP"
        }
      }
    });
    console.log("EMISSAO OK");
    console.log(`  codigoSolicitacao: ${boleto.gatewayTransactionId}`);
    console.log(`  linhaDigitavel: ${boleto.identificationField?.slice(0, 30)}…`);
    console.log(`  situacao: ${String((boleto.providerRaw as { situacao?: string })?.situacao ?? "?")}`);
  } catch (e) {
    const err = e as Error & { httpStatus?: number; providerBody?: unknown };
    console.error("EMISSAO FALHOU:", err.message);
    if (err.httpStatus) console.error("  httpStatus:", err.httpStatus);
    if (err.providerBody !== undefined) {
      console.error("  providerBody:", JSON.stringify(err.providerBody, null, 2));
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
