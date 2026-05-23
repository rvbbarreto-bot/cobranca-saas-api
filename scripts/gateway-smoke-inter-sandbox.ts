/**
 * Smoke Inter sandbox — OAuth mTLS (sem secrets no repo).
 *
 * Uso:
 *   RUN_INTER_SANDBOX=1 npm run gateway:smoke:inter
 *
 * Variáveis:
 *   INTER_CLIENT_ID, INTER_CLIENT_SECRET (obrigatórios)
 *   INTER_CERT_PEM + INTER_KEY_PEM  OU  INTER_CERT_PATH + INTER_KEY_PATH
 */
import fs from "node:fs";
import { buildMtlsAgent } from "../src/platform/payment-gateway/mtls-agent";
import { validateMtlsPemPair } from "../src/platform/payment-gateway/mtls-credential-validation";
import { getInterAccessToken } from "../src/modules/payment-gateway/infrastructure/inter/inter-oauth";

function readPemFromEnv(): { certPem: string; keyPem: string } {
  const inlineCert = process.env.INTER_CERT_PEM?.trim();
  const inlineKey = process.env.INTER_KEY_PEM?.trim();
  if (inlineCert && inlineKey) {
    return { certPem: inlineCert, keyPem: inlineKey };
  }

  const certPath = process.env.INTER_CERT_PATH?.trim();
  const keyPath = process.env.INTER_KEY_PATH?.trim();
  if (!certPath || !keyPath) {
    console.error(
      "Defina INTER_CERT_PEM+INTER_KEY_PEM ou INTER_CERT_PATH+INTER_KEY_PATH (e INTER_CLIENT_ID/SECRET)."
    );
    process.exit(1);
  }
  return {
    certPem: fs.readFileSync(certPath, "utf8"),
    keyPem: fs.readFileSync(keyPath, "utf8")
  };
}

async function main(): Promise<void> {
  if (process.env.RUN_INTER_SANDBOX !== "1") {
    console.info("Defina RUN_INTER_SANDBOX=1 para executar smoke Inter.");
    process.exit(0);
  }

  const clientId = process.env.INTER_CLIENT_ID?.trim();
  const clientSecret = process.env.INTER_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    console.error("Defina INTER_CLIENT_ID e INTER_CLIENT_SECRET.");
    process.exit(1);
  }

  const { certPem, keyPem } = readPemFromEnv();
  const pemCheck = validateMtlsPemPair(certPem, keyPem);
  if (!pemCheck.ok) {
    console.error("PEM invalido:", pemCheck.message);
    process.exit(1);
  }
  console.info("PEM: OK (par certificado/chave parseavel).");

  const agent = buildMtlsAgent({ certPem, keyPem });
  const token = await getInterAccessToken(
    {
      tenantId: "smoke-inter-sandbox",
      provider: "inter",
      sandbox: true,
      credentials: { client_id: clientId, client_secret: clientSecret }
    },
    agent
  );

  const preview = token.length > 12 ? `${token.slice(0, 8)}…` : "(curto)";
  console.info("OAuth Inter sandbox: OK — access_token obtido.", preview);
  console.info(
    "Proximo passo: emissao via portal/worker ou Postman (postman/Inter_Gateway_Homolog.postman_collection.json)."
  );
}

main().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("Smoke Inter falhou:", msg.split("\n")[0]);
  process.exit(1);
});
