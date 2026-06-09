import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createApp } from "../../src/app";
import {
  runSeedPortalHappyPath,
  SEED_PORTAL_DEFAULT_PASSWORD,
  SEED_PORTAL_EMAIL,
  SEED_AUTOMACAO_SLUG
} from "../../src/dev/seed-portal-happy-path";
import { ensureOrganizationForEscritorio } from "../../src/modules/exeq-platform/infrastructure/organization-repository";
import { processFiscalIngestValidateJob } from "../../src/modules/fiscal-ingestion/application/process-fiscal-ingest-validate";
import { processSerproTransmitJob } from "../../src/modules/fiscal-processamento/application/process-serpro-transmit-job";
import { closePool, getPool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const TEST_CNPJ = "00000000000191";

function pickUniqueCompetencia(): string {
  const now = new Date();
  const offsetMonths = (Date.now() % 18) + 2;
  const d = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function buildCsvForCompetencia(competencia: string): string {
  const template = readFileSync(join(process.cwd(), "docs/templates/pgdasd-import-v1.csv"), "utf8");
  const lines = template.trimEnd().split(/\r?\n/);
  const header = lines[0]!;
  const cols = lines[1]!.split(",");
  cols[1] = competencia;
  return `${header}\n${cols.join(",")}\n`;
}

describe.skipIf(!hasDb)("FISC-053 — audit trail apuração SERPRO (integração)", () => {
  let app: ReturnType<typeof createApp>;
  let tenantId = "";
  let adminToken = "";
  const competencia = pickUniqueCompetencia();
  const correlationId = randomUUID();
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;
  const previousMock = process.env.FISCAL_SERPRO_MOCK;
  const previousProc = process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO;
  const previousEnc = process.env.ENCRYPTION_KEY;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.FISCAL_SERPRO_MOCK = "true";
    process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO = "false";
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY?.trim() || "a".repeat(64);

    app = createApp();
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    tenantId = seed.automacaoTenantId;

    const client = await getPool().connect();
    try {
      await ensureOrganizationForEscritorio(client, {
        automacaoTenantId: tenantId,
        slug: SEED_AUTOMACAO_SLUG,
        name: "Escritorio Demo"
      });
      await client.query(
        `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email)
         VALUES ($1, $2, 'cnpj', $3, $4)
         ON CONFLICT (tenant_id, documento) DO UPDATE SET nome = EXCLUDED.nome`,
        [tenantId, TEST_CNPJ, "Empresa PGDASD Audit", "pgdasd-audit@local.dev"]
      );
    } finally {
      client.release();
    }

    const login = await request(app)
      .post("/v1/portal/auth/login")
      .send({
        email: SEED_PORTAL_EMAIL,
        tenant_id: tenantId,
        password: SEED_PORTAL_DEFAULT_PASSWORD
      })
      .expect(200);
    adminToken = login.body.access_token as string;
  });

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.FISCAL_GUIAS_ENABLED;
    else process.env.FISCAL_GUIAS_ENABLED = previousFlag;
    if (previousMock === undefined) delete process.env.FISCAL_SERPRO_MOCK;
    else process.env.FISCAL_SERPRO_MOCK = previousMock;
    if (previousProc === undefined) delete process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO;
    else process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO = previousProc;
    if (previousEnc === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previousEnc;
    await closePool().catch(() => undefined);
  });

  it("registra apuracao_iniciada e transmitida com correlation_id no audit log", async () => {
    const csv = buildCsvForCompetencia(competencia);

    const postIngest = await request(app)
      .post("/v1/portal/fiscal/ingest/csv")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .attach("file", Buffer.from(csv, "utf8"), `pgdasd-${competencia}.csv`)
      .expect(202);

    const ingestId = postIngest.body.ingest.id as string;
    await processFiscalIngestValidateJob({ ingestId, automacaoTenantId: tenantId });

    const createProc = await request(app)
      .post("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .set("x-correlation-id", correlationId)
      .send({ fiscal_ingest_id: ingestId })
      .expect(201);

    const processamentoId = createProc.body.processamentos[0].id as string;
    expect(createProc.headers["x-correlation-id"]).toBe(correlationId);

    await processSerproTransmitJob({ processamentoId, automacaoTenantId: tenantId });

    const auditIniciada = await request(app)
      .get("/v1/portal/fiscal/audit?action=apuracao_iniciada&limit=50")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(auditIniciada.body.entries.length).toBeGreaterThanOrEqual(1);
    const iniciada = auditIniciada.body.entries.find(
      (e: { resource_id: string }) => e.resource_id === processamentoId
    );
    expect(iniciada).toMatchObject({
      action: "apuracao_iniciada",
      resource_type: "processamento_fiscal"
    });
    expect(iniciada.new_value?.correlation_id).toBe(correlationId);
    expect(iniciada.new_value?.fiscal_ingest_id).toBe(ingestId);

    const auditTransmitida = await request(app)
      .get(`/v1/portal/fiscal/audit?action=transmitida&limit=50`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    const transmitida = auditTransmitida.body.entries.find(
      (e: { resource_id: string }) => e.resource_id === processamentoId
    );
    expect(transmitida).toMatchObject({
      action: "transmitida",
      resource_type: "processamento_fiscal"
    });
    expect(transmitida.new_value?.correlation_id).toBe(correlationId);
    expect(transmitida.new_value?.protocolo_serpro).toMatch(/^MOCK-DECL-/);
  });
});
