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
import { closePool, getPool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const TEST_CNPJ = "00000000000191";

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

describe.skipIf(!hasDb)("Sprint 5 — pipeline CONCLUIDO + procuração SERPRO", () => {
  let app: ReturnType<typeof createApp>;
  let tenantId = "";
  let portalClienteId = "";
  let adminToken = "";
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;
  const previousMock = process.env.FISCAL_SERPRO_MOCK;
  const previousProc = process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO;
  const previousEnc = process.env.ENCRYPTION_KEY;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.FISCAL_SERPRO_MOCK = "true";
    process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO = "true";
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
      const ins = await client.query<{ id: string }>(
        `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email)
         VALUES ($1, $2, 'cnpj', $3, $4)
         ON CONFLICT (tenant_id, documento) DO UPDATE SET nome = EXCLUDED.nome
         RETURNING id::text`,
        [tenantId, TEST_CNPJ, "Empresa PGDASD Demo", "pgdasd-demo@local.dev"]
      );
      portalClienteId = ins.rows[0]?.id ?? "";
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

  it("procuração validada SERPRO + pipeline até CONCLUIDO com guia_fiscal_id", async () => {
    await request(app)
      .post("/v1/portal/fiscal/procuracoes")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .send({
        portal_cliente_id: portalClienteId,
        procurador_documento: "12345678901",
        validade_inicio: "2026-01-01",
        validade_fim: "2027-12-31"
      })
      .expect(201);

    const validar = await request(app)
      .post("/v1/portal/fiscal/procuracoes/validar-serpro")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .send({ portal_cliente_id: portalClienteId, contribuinte_cnpj: TEST_CNPJ })
      .expect(200);

    expect(validar.body.situacao).toBe("valida");

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

    const processamentoId = createProc.body.processamentos[0].id as string;
    await processSerproTransmitJob({ processamentoId, automacaoTenantId: tenantId });
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise<void>((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setTimeout(resolve, 150));

    const detail = await request(app)
      .get(`/v1/portal/fiscal/processamentos/${processamentoId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(detail.body.processamento.status).toBe("CONCLUIDO");
    expect(detail.body.processamento.guia_fiscal_id).toBeTruthy();
    expect(detail.body.processamento.recibo_disponivel).toBe(true);

    const reciboUrl = await request(app)
      .get(`/v1/portal/fiscal/processamentos/${processamentoId}/recibo/url`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(reciboUrl.body.pdf_url).toBeTruthy();
  });
});
