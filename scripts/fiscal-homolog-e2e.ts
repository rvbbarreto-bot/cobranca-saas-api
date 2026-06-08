/**
 * E2E homolog fiscal DAS + DARF — certificado → inbox → captura Receita → PDF → WhatsApp.
 *
 * Pre-requisitos:
 *   npm run migrate && npm run seed:dev
 *   .env: DATABASE_URL, ENCRYPTION_KEY, RECEITA_DAS_CAPTURE_URL
 *   Homolog local: npm run receita:mock:gateway (outro terminal)
 *
 * Uso:
 *   RUN_FISCAL_HOMOLOG_E2E=1 npm run fiscal:homolog:e2e
 */
import "dotenv/config";
import {
  runFiscalHomologE2E,
  writeFiscalHomologE2EEvidenceReport
} from "../src/dev/fiscal-homolog-e2e-runner";

async function main(): Promise<void> {
  if (process.env.RUN_FISCAL_HOMOLOG_E2E !== "1") {
    console.info("Defina RUN_FISCAL_HOMOLOG_E2E=1 para executar E2E fiscal homolog.");
    console.info(
      "Homolog local: npm run receita:mock:gateway && RECEITA_DAS_CAPTURE_URL=http://127.0.0.1:19443"
    );
    process.exit(0);
  }

  const db = process.env.DATABASE_URL?.trim();
  if (!db) {
    console.error("DATABASE_URL ausente.");
    process.exit(1);
  }

  if (process.env.FISCAL_CAPTURE_STUB?.trim().toLowerCase() === "true") {
    console.error("FISCAL_CAPTURE_STUB=true conflita com E2E real. Defina false ou remova.");
    process.exit(1);
  }

  console.log("Iniciando E2E fiscal homolog (DAS + DARF)…");
  console.log(`Receita: ${process.env.RECEITA_DAS_CAPTURE_URL ?? "(nao definida)"}`);

  const evidence = await runFiscalHomologE2E(db);
  const path = writeFiscalHomologE2EEvidenceReport(evidence);
  const ok = evidence.assertions.filter((a) => a.ok).length;
  console.log(`E2E concluido. Evidencias: ${path}`);
  console.log(`Assertions: ${ok}/${evidence.assertions.length} OK`);
  console.log(`Guia DAS: ${JSON.stringify(evidence.steps.guiaDas ?? {})}`);
  console.log(`Guia DARF: ${JSON.stringify(evidence.steps.guiaDarf ?? {})}`);
}

main().catch((err) => {
  console.error("E2E fiscal homolog falhou:", err instanceof Error ? err.message : err);
  process.exit(1);
});
