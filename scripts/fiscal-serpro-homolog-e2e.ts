/**
 * E2E homolog SERPRO demo — CSV PGDASD → transmit → recibo → DAS.
 *
 * Pre-requisitos:
 *   npm run migrate && npm run seed:dev
 *   .env: DATABASE_URL, ENCRYPTION_KEY
 *
 * Uso (mock demo — default):
 *   RUN_FISCAL_SERPRO_HOMOLOG_E2E=1 npm run fiscal:serpro:homolog:e2e
 *
 * Demo live SERPRO (credenciais em fiscal.serpro_config):
 *   RUN_FISCAL_SERPRO_HOMOLOG_E2E=1 FISCAL_SERPRO_MOCK=false npm run fiscal:serpro:homolog:e2e
 */
import "dotenv/config";
import {
  runFiscalSerproHomologE2E,
  writeFiscalSerproHomologE2EEvidenceReport
} from "../src/dev/fiscal-serpro-homolog-e2e-runner";

async function main(): Promise<void> {
  if (process.env.RUN_FISCAL_SERPRO_HOMOLOG_E2E !== "1") {
    console.info("Defina RUN_FISCAL_SERPRO_HOMOLOG_E2E=1 para executar E2E SERPRO homolog.");
    console.info("Mock demo: npm run fiscal:serpro:homolog:e2e");
    console.info("Live demo: FISCAL_SERPRO_MOCK=false npm run fiscal:serpro:homolog:e2e");
    process.exit(0);
  }

  const db = process.env.DATABASE_URL?.trim();
  if (!db) {
    console.error("DATABASE_URL ausente.");
    process.exit(1);
  }

  const mock = process.env.FISCAL_SERPRO_MOCK?.trim().toLowerCase() !== "false";
  console.log("Iniciando E2E SERPRO homolog (EXEQ-FISC-090)…");
  console.log(`Modo: ${mock ? "mock demo" : "live SERPRO demo"}`);

  const evidence = await runFiscalSerproHomologE2E(db);
  const path = writeFiscalSerproHomologE2EEvidenceReport(evidence);
  const ok = evidence.assertions.filter((a) => a.ok).length;
  console.log(`E2E concluido. Evidencias: ${path}`);
  console.log(`Assertions: ${ok}/${evidence.assertions.length} OK`);
  console.log(`Processamento: ${JSON.stringify(evidence.steps.processamentoFinal ?? {})}`);
}

main().catch((err) => {
  console.error("E2E SERPRO homolog falhou:", err instanceof Error ? err.message : err);
  process.exit(1);
});
