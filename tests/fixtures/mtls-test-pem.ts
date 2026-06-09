import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

/** Par PEM válido para testes (CN=local-test, gerado via openssl). */
export const TEST_MTLS_CERTIFICATE_PEM = fs.readFileSync(path.join(dir, "test-mtls.crt"), "utf8").trim();
export const TEST_MTLS_PRIVATE_KEY_PEM = fs.readFileSync(path.join(dir, "test-mtls.key"), "utf8").trim();

export const TEST_INTER_GATEWAY_CREDENTIALS = {
  client_id: "00000000-0000-4000-8000-000000000099",
  client_secret: "test-inter-client-secret",
  certificate_pem: TEST_MTLS_CERTIFICATE_PEM,
  private_key_pem: TEST_MTLS_PRIVATE_KEY_PEM
} as const;
