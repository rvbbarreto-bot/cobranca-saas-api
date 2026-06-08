import { readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../app";
import {
  runSeedPortalHappyPath,
  SEED_PORTAL_DEFAULT_PASSWORD,
  SEED_PORTAL_EMAIL,
  SEED_AUTOMACAO_SLUG
} from "./seed-portal-happy-path";
import {
  buildFiscalSerproHomologTestsNote,
  gitField,
  maskDbUrl,
  recordFiscalSerproAssertion,
  type FiscalSerproHomologE2EEvidence,
  writeFiscalSerproHomologE2EEvidenceReport
} from "./fiscal-e2e-evidence-utils";
import { ensureOrganizationForEscritorio } from "../modules/exeq-platform/infrastructure/organization-repository";
import { processFiscalIngestValidateJob } from "../modules/fiscal-ingestion/application/process-fiscal-ingest-validate";
import { processSerproTransmitJob } from "../modules/fiscal-processamento/application/process-serpro-transmit-job";
import { processSerproReciboJob } from "../modules/fiscal-processamento/application/process-serpro-recibo-job";
import { processSerproEmitDasJob } from "../modules/fiscal-processamento/application/process-serpro-emit-das-job";
import { closePool, getPool } from "../platform/persistence/pool";
import { resetObjectStorageCache } from "../platform/storage/get-object-storage";

export type { FiscalSerproHomologE2EEvidence };
export { writeFiscalSerproHomologE2EEvidenceReport };

const TEST_CNPJ = "00000000000191";
const CSV_TEMPLATE = join(process.cwd(), "docs/templates/pgdasd-import-v1.csv");

async function assertProcessamentoSchemaReady(): Promise<void> {
  const pool = getPool();
  const r = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('fiscal.processamento_fiscal') IS NOT NULL AS ok`
  );
  if (!r.rows[0]?.ok) {
    throw new Error("Schema fiscal.processamento_fiscal ausente. Execute: npm run migrate");
  }
}

function buildCsvForCompetencia(competencia: string): string {
  const template = readFileSync(CSV_TEMPLATE, "utf8");
  const lines = template.trimEnd().split(/\r?\n/);
  if (lines.length < 2) {
    throw new Error("Template CSV PGDASD invalido.");
  }
  const header = lines[0]!;
  const cols = lines[1]!.split(",");
  cols[1] = competencia;
  return `${header}\n${cols.join(",")}\n`;
}

function pickUniqueCompetencia(): string {
  const now = new Date();
  const offsetMonths = (Date.now() % 24) + 1;
  const d = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function portalLogin(
  app: ReturnType<typeof createApp>,
  automacaoTenantId: string
): Promise<string> {
  const r = await request(app)
    .post("/v1/portal/auth/login")
    .send({
      email: SEED_PORTAL_EMAIL,
      tenant_id: automacaoTenantId,
      password: SEED_PORTAL_DEFAULT_PASSWORD
    })
    .expect(200);
  return r.body.access_token as string;
}

export async function runFiscalSerproHomologE2E(
  connectionString: string
): Promise<FiscalSerproHomologE2EEvidence> {
  const encryptionKey = process.env.ENCRYPTION_KEY?.trim();
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY obrigatoria para E2E SERPRO homolog.");
  }

  const serproMock = process.env.FISCAL_SERPRO_MOCK?.trim().toLowerCase() !== "false";
  process.env.FISCAL_GUIAS_ENABLED = "true";
  process.env.FISCAL_SERPRO_MOCK = serproMock ? "true" : "false";
  process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO = "false";
  process.env.ENABLE_BULLMQ_WORKERS = "false";
  process.env.FISCAL_PDF_STORAGE = process.env.FISCAL_PDF_STORAGE?.trim() || "local";
  process.env.FISCAL_PDF_LOCAL_DIR =
    process.env.FISCAL_PDF_LOCAL_DIR?.trim() || "./data/fiscal-serpro-homolog-e2e";
  resetObjectStorageCache();

  const correlationId = `serpro-e2e-${Date.now()}`;
  const competencia = pickUniqueCompetencia();

  const evidence: FiscalSerproHomologE2EEvidence = {
    executedAt: new Date().toISOString(),
    git: {
      branch: gitField("git rev-parse --abbrev-ref HEAD"),
      commit: gitField("git rev-parse HEAD")
    },
    issue: "EXEQ-FISC-090",
    environment: {
      nodeEnv: process.env.NODE_ENV ?? "development",
      databaseUrl: maskDbUrl(connectionString),
      fiscalSerproMock: serproMock,
      fiscalPdfStorage: process.env.FISCAL_PDF_STORAGE,
      hasEncryptionKey: true
    },
    automacaoTenantId: "",
    organizationId: "",
    correlationId,
    competencia,
    steps: {},
    assertions: [],
    automatedTestsNote: buildFiscalSerproHomologTestsNote()
  };

  await assertProcessamentoSchemaReady();
  recordFiscalSerproAssertion(evidence, "schema_processamento_ready", true);

  const seed = await runSeedPortalHappyPath(connectionString);
  evidence.automacaoTenantId = seed.automacaoTenantId;

  const pool = getPool();
  const dbClient = await pool.connect();
  try {
    evidence.organizationId = await ensureOrganizationForEscritorio(dbClient, {
      automacaoTenantId: seed.automacaoTenantId,
      slug: SEED_AUTOMACAO_SLUG,
      name: "Escritorio Demo"
    });
    await dbClient.query(
      `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email)
       VALUES ($1, $2, 'cnpj', $3, $4)
       ON CONFLICT (tenant_id, documento) DO UPDATE SET nome = EXCLUDED.nome`,
      [seed.automacaoTenantId, TEST_CNPJ, "Empresa PGDASD Demo E2E", "pgdasd-serpro-e2e@local.dev"]
    );
    recordFiscalSerproAssertion(evidence, "cliente_pgdasd_cadastrado", true, TEST_CNPJ);
  } finally {
    dbClient.release();
  }

  const app = createApp();
  const adminToken = await portalLogin(app, seed.automacaoTenantId);
  evidence.steps.adminLogin = { ok: true };

  const csv = buildCsvForCompetencia(competencia);
  const postIngest = await request(app)
    .post("/v1/portal/fiscal/ingest/csv")
    .set("Authorization", `Bearer ${adminToken}`)
    .set("x-tenant-id", seed.automacaoTenantId)
    .attach("file", Buffer.from(csv, "utf8"), `pgdasd-${competencia}.csv`)
    .expect(202);

  const ingestId = postIngest.body.ingest.id as string;
  evidence.steps.ingest = { id: ingestId, status: postIngest.body.ingest.status };

  await processFiscalIngestValidateJob({
    ingestId,
    automacaoTenantId: seed.automacaoTenantId
  });

  const ingestAfter = await request(app)
    .get(`/v1/portal/fiscal/ingest/${ingestId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .set("x-tenant-id", seed.automacaoTenantId)
    .expect(200);

  evidence.steps.ingestValidated = ingestAfter.body.ingest;
  recordFiscalSerproAssertion(
    evidence,
    "csv_ingest_validado",
    ingestAfter.body.ingest.status === "VALIDADO",
    `status=${ingestAfter.body.ingest.status}`
  );

  const createProc = await request(app)
    .post("/v1/portal/fiscal/processamentos")
    .set("Authorization", `Bearer ${adminToken}`)
    .set("x-tenant-id", seed.automacaoTenantId)
    .send({ fiscal_ingest_id: ingestId })
    .expect(201);

  const processamentoId = createProc.body.processamentos[0].id as string;
  evidence.steps.processamento = createProc.body.processamentos[0];
  recordFiscalSerproAssertion(
    evidence,
    "processamento_criado",
    createProc.body.processamentos.length === 1 && createProc.body.processamentos[0].status === "VALIDADO",
    processamentoId
  );

  await processSerproTransmitJob({
    processamentoId,
    automacaoTenantId: seed.automacaoTenantId
  });
  await processSerproReciboJob({
    processamentoId,
    automacaoTenantId: seed.automacaoTenantId
  });
  await processSerproEmitDasJob({
    processamentoId,
    automacaoTenantId: seed.automacaoTenantId
  });

  const detail = await request(app)
    .get(`/v1/portal/fiscal/processamentos/${processamentoId}`)
    .set("Authorization", `Bearer ${adminToken}`)
    .set("x-tenant-id", seed.automacaoTenantId)
    .expect(200);

  const proc = detail.body.processamento;
  evidence.steps.processamentoFinal = proc;
  evidence.steps.eventos = detail.body.eventos;

  recordFiscalSerproAssertion(
    evidence,
    "transmissao_serpro_concluida",
    proc.status === "CONCLUIDO" && Boolean(proc.protocolo_serpro),
    `status=${proc.status}; protocolo=${proc.protocolo_serpro ?? "null"}`
  );
  recordFiscalSerproAssertion(
    evidence,
    "recibo_pdf_persistido",
    Boolean(proc.recibo_disponivel),
    `recibo_disponivel=${proc.recibo_disponivel}`
  );
  recordFiscalSerproAssertion(
    evidence,
    "das_guia_concluido",
    Boolean(proc.guia_fiscal_id),
    proc.guia_fiscal_id ?? "null"
  );

  const reciboUrl = await request(app)
    .get(`/v1/portal/fiscal/processamentos/${processamentoId}/recibo/url`)
    .set("Authorization", `Bearer ${adminToken}`)
    .set("x-tenant-id", seed.automacaoTenantId)
    .expect(200);

  evidence.steps.reciboUrl = {
    expires_in_seconds: reciboUrl.body.expires_in_seconds,
    pdf_url_prefix: String(reciboUrl.body.pdf_url ?? "").slice(0, 48)
  };
  recordFiscalSerproAssertion(
    evidence,
    "recibo_url_acessivel",
    Boolean(reciboUrl.body.pdf_url?.trim()),
    `expires=${reciboUrl.body.expires_in_seconds}`
  );

  const guiaId = proc.guia_fiscal_id as string;
  const guiaPdf = await request(app)
    .get(`/v1/portal/fiscal/guias/${guiaId}/pdf-url`)
    .set("Authorization", `Bearer ${adminToken}`)
    .set("x-tenant-id", seed.automacaoTenantId)
    .expect(200);

  evidence.steps.guiaPdfUrl = {
    guia_id: guiaId,
    expires_in_seconds: guiaPdf.body.expires_in_seconds,
    pdf_url_prefix: String(guiaPdf.body.pdf_url ?? "").slice(0, 48)
  };
  recordFiscalSerproAssertion(
    evidence,
    "guia_pdf_acessivel",
    Boolean(guiaPdf.body.pdf_url?.trim()),
    guiaId
  );

  await closePool();
  return evidence;
}
