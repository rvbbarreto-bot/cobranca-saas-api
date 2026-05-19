/**
 * E2E Asaas Sandbox — gera relatorio JSON em docs/evidencias/.
 *
 * Pre-requisitos:
 *   npm run migrate
 *   npm run seed:dev
 *   .env com DATABASE_URL, ASAAS_API_KEY (sandbox), ENCRYPTION_KEY, WEBHOOK_INBOX_SECRET
 *
 * Uso:
 *   npm run e2e:asaas:evidence
 */
import "dotenv/config";
import { runAsaasSandboxE2E, writeAsaasE2EEvidenceReport } from "../src/dev/asaas-sandbox-e2e-runner";

async function main(): Promise<void> {
  const db = process.env.DATABASE_URL?.trim();
  if (!db) {
    console.error("DATABASE_URL ausente.");
    process.exit(1);
  }

  console.log("Iniciando E2E Asaas Sandbox…");
  const evidence = await runAsaasSandboxE2E(db);
  const path = writeAsaasE2EEvidenceReport(evidence);
  console.log(`E2E concluido. Evidencias: ${path}`);
  console.log(`Assertions: ${evidence.assertions.filter((a) => a.ok).length}/${evidence.assertions.length} OK`);
}

main().catch((err) => {
  console.error("E2E Asaas falhou:", err instanceof Error ? err.message : err);
  process.exit(1);
});
