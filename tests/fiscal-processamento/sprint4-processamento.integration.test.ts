import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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
import { getProcessamentoById } from "../../src/modules/fiscal-processamento/infrastructure/processamento-fiscal-repository";
import { buildSerproPgdasdTransmitRequest } from "../../src/modules/serpro-integra-contador/infrastructure/serpro-request-builder";
import { parsePgdasdPedidoDados } from "../../src/modules/serpro-integra-contador/domain/pgdasd-transmissao-payload";
import type { CanonicalApuracao } from "../../src/modules/fiscal-ingestion/domain/canonical-apuracao.schema";
import { closePool, getPool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const TEST_CNPJ = "00000000000191";

async function assertProcessamentoSchemaReady(): Promise<void> {
  const pool = getPool();
  await pool.query("SELECT 1");
  const r = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('fiscal.processamento_fiscal') IS NOT NULL AS ok`
  );
  if (!r.rows[0]?.ok) {
    throw new Error("Execute npm run migrate (035_processamento_fiscal.sql)");
  }
}

async function portalLogin(app: ReturnType<typeof createApp>, automacaoTenantId: string): Promise<string> {
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

async function waitForSetImmediate(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe.skipIf(!hasDb)("Sprint 4 — processamento + transmissao SERPRO mock", () => {
  let app: ReturnType<typeof createApp>;
  let tenantId = "";
  let adminToken = "";
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;
  const previousMock = process.env.FISCAL_SERPRO_MOCK;
  const previousProc = process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO;
  const previousEnc = process.env.ENCRYPTION_KEY;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.FISCAL_SERPRO_MOCK = "true";
    process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO = "false";
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY?.trim() || "a".repeat(64);
    await assertProcessamentoSchemaReady();

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
        [tenantId, TEST_CNPJ, "Empresa PGDASD Demo", "pgdasd-demo@local.dev"]
      );
    } finally {
      client.release();
    }

    adminToken = await portalLogin(app, tenantId);
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

  it("ingest VALIDADO → processamento → TRANSMITIDA (mock SERPRO)", async () => {
    const csv = readFileSync(join(process.cwd(), "docs/templates/pgdasd-import-v1.csv"), "utf8");

    const postIngest = await request(app)
      .post("/v1/portal/fiscal/ingest/csv")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .attach("file", Buffer.from(csv, "utf8"), "pgdasd-import-v1.csv")
      .expect(202);

    const ingestId = postIngest.body.ingest.id as string;
    await processFiscalIngestValidateJob({ ingestId, automacaoTenantId: tenantId });

    const createProc = await request(app)
      .post("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .send({ fiscal_ingest_id: ingestId })
      .expect(201);

    expect(createProc.body.processamentos).toHaveLength(1);
    expect(createProc.body.processamentos[0].status).toBe("VALIDADO");
    const processamentoId = createProc.body.processamentos[0].id as string;

    const procRow = await getProcessamentoById(getPool(), tenantId, processamentoId);
    expect(procRow).toBeTruthy();
    const canonical = procRow!.canonicalSnapshot as CanonicalApuracao;
    const serproReq = buildSerproPgdasdTransmitRequest({
      contratanteCnpj: TEST_CNPJ,
      contribuinteCnpj: canonical.cnpj,
      apuracao: canonical
    });
    const pgdasdDados = parsePgdasdPedidoDados(serproReq.pedidoDados.dados);
    expect(pgdasdDados.cnpjCompleto).toBe(TEST_CNPJ);
    expect(pgdasdDados.pa).toBe(202605);
    expect(pgdasdDados.declaracao.receitaPaCompetenciaInterno).toBe(85000);
    expect(pgdasdDados.declaracao.estabelecimentos[0]?.cnpjCompleto).toBe(TEST_CNPJ);

    await waitForSetImmediate();
    await processSerproTransmitJob({ processamentoId, automacaoTenantId: tenantId });

    const detail = await request(app)
      .get(`/v1/portal/fiscal/processamentos/${processamentoId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(["TRANSMITIDA", "RECIBO_OK", "CONCLUIDO"]).toContain(detail.body.processamento.status);
    expect(detail.body.processamento.protocolo_serpro).toMatch(/^MOCK-DECL-/);
    expect(
      detail.body.eventos.some(
        (e: { evento: string }) =>
          e.evento === "transmissao_concluida" || e.evento === "recibo_ok"
      )
    ).toBe(true);

    const list = await request(app)
      .get("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(list.body.processamentos.some((p: { id: string }) => p.id === processamentoId)).toBe(true);
  });

  it("POST processamentos com ingest nao validado retorna 409", async () => {
    const csv = "cnpj,competencia\nbad,2026-05";
    const postIngest = await request(app)
      .post("/v1/portal/fiscal/ingest/csv")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .attach("file", Buffer.from(csv, "utf8"), "invalid.csv")
      .expect(202);

    const ingestId = postIngest.body.ingest.id as string;
    await processFiscalIngestValidateJob({ ingestId, automacaoTenantId: tenantId });

    await request(app)
      .post("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .send({ fiscal_ingest_id: ingestId })
      .expect(409);
  });
});
