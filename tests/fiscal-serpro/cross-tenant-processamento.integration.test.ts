import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
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
import { processSerproReciboJob } from "../../src/modules/fiscal-processamento/application/process-serpro-recibo-job";
import { closePool, getPool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const OTHER_PUBLIC_TENANT_UUID = "00000000-0000-4000-8000-000000000002";
const TEST_CNPJ = "00000000000191";
const TENANT_B_SLUG = "escritorio-proc-cross-test";

async function assertProcessamentoSchemaReady(): Promise<boolean> {
  const pool = getPool();
  const r = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('fiscal.processamento_fiscal') IS NOT NULL AS ok`
  );
  return Boolean(r.rows[0]?.ok);
}

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

describe.skipIf(!hasDb)("Fiscal processamento — isolamento cross-tenant (EXEQ-FISC-091)", () => {
  let app: ReturnType<typeof createApp>;
  let tenantA = "";
  let tenantB = "";
  let tokenA = "";
  let tokenB = "";
  let processamentoIdA = "";
  let ingestIdA = "";
  const competencia = pickUniqueCompetencia();
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;
  const previousMock = process.env.FISCAL_SERPRO_MOCK;
  const previousProc = process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO;
  const previousEnc = process.env.ENCRYPTION_KEY;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.FISCAL_SERPRO_MOCK = "true";
    process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO = "false";
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY?.trim() || "a".repeat(64);

    if (!(await assertProcessamentoSchemaReady())) {
      return;
    }

    app = createApp();
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    tenantA = seed.automacaoTenantId;

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    try {
      tenantB = await ensureAutomacaoTenantB(client);
      await ensureMembershipBothTenants(client, tenantA, tenantB);
      await ensureBillingLinkTenantB(client, tenantB);

      await ensureOrganizationForEscritorio(client, {
        automacaoTenantId: tenantA,
        slug: SEED_AUTOMACAO_SLUG,
        name: "Escritorio Demo"
      });
      await ensureOrganizationForEscritorio(client, {
        automacaoTenantId: tenantB,
        slug: TENANT_B_SLUG,
        name: "Escritorio Proc Cross-test"
      });

      await client.query(
        `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email)
         VALUES ($1, $2, 'cnpj', $3, $4)
         ON CONFLICT (tenant_id, documento) DO UPDATE SET nome = EXCLUDED.nome`,
        [tenantA, TEST_CNPJ, "Empresa PGDASD Cross A", "pgdasd-cross-a@local.dev"]
      );
    } finally {
      await client.end();
    }

    tokenA = await portalLogin(app, tenantA);
    tokenB = await portalLogin(app, tenantB);

    const csv = buildCsvForCompetencia(competencia);
    const postIngest = await request(app)
      .post("/v1/portal/fiscal/ingest/csv")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .attach("file", Buffer.from(csv, "utf8"), `pgdasd-${competencia}.csv`)
      .expect(202);

    ingestIdA = postIngest.body.ingest.id as string;
    await processFiscalIngestValidateJob({ ingestId: ingestIdA, automacaoTenantId: tenantA });

    const createProc = await request(app)
      .post("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .send({ fiscal_ingest_id: ingestIdA })
      .expect(201);

    processamentoIdA = createProc.body.processamentos[0].id as string;
    await processSerproTransmitJob({ processamentoId: processamentoIdA, automacaoTenantId: tenantA });
    await processSerproReciboJob({ processamentoId: processamentoIdA, automacaoTenantId: tenantA });
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

  it("tenant A lista processamento proprio", async (ctx) => {
    if (!processamentoIdA || !tokenA) ctx.skip();

    const res = await request(app)
      .get("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantA)
      .expect(200);

    const ids = (res.body.processamentos as { id: string }[]).map((p) => p.id);
    expect(ids).toContain(processamentoIdA);
  });

  it("tenant B nao ve processamento do tenant A", async (ctx) => {
    if (!processamentoIdA || !tokenB || !tenantB) ctx.skip();

    const res = await request(app)
      .get("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${tokenB}`)
      .set("x-tenant-id", tenantB)
      .expect(200);

    const ids = (res.body.processamentos as { id: string }[]).map((p) => p.id);
    expect(ids).not.toContain(processamentoIdA);
  });

  it("tenant B nao acessa detalhe do processamento A", async (ctx) => {
    if (!processamentoIdA || !tokenB || !tenantB) ctx.skip();

    await request(app)
      .get(`/v1/portal/fiscal/processamentos/${processamentoIdA}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .set("x-tenant-id", tenantB)
      .expect(404);
  });

  it("tenant B nao obtem URL de recibo do processamento A", async (ctx) => {
    if (!processamentoIdA || !tokenB || !tenantB) ctx.skip();

    await request(app)
      .get(`/v1/portal/fiscal/processamentos/${processamentoIdA}/recibo/url`)
      .set("Authorization", `Bearer ${tokenB}`)
      .set("x-tenant-id", tenantB)
      .expect(404);
  });

  it("JWT tenant A com x-tenant-id do tenant B retorna 403", async (ctx) => {
    if (!tokenA || !tenantB) ctx.skip();

    await request(app)
      .get("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${tokenA}`)
      .set("x-tenant-id", tenantB)
      .expect(403);
  });

  it("tenant B nao cria processamento a partir do ingest do tenant A", async (ctx) => {
    if (!ingestIdA || !tokenB || !tenantB) ctx.skip();

    await request(app)
      .post("/v1/portal/fiscal/processamentos")
      .set("Authorization", `Bearer ${tokenB}`)
      .set("x-tenant-id", tenantB)
      .send({ fiscal_ingest_id: ingestIdA })
      .expect(404);
  });

  it("tenant B nao consulta ingest do tenant A", async (ctx) => {
    if (!ingestIdA || !tokenB || !tenantB) ctx.skip();

    await request(app)
      .get(`/v1/portal/fiscal/ingest/${ingestIdA}`)
      .set("Authorization", `Bearer ${tokenB}`)
      .set("x-tenant-id", tenantB)
      .expect(404);
  });
});

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

async function ensureAutomacaoTenantB(client: pg.Client): Promise<string> {
  const existing = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM automacao.tenants WHERE lower(trim(slug)) = lower(trim($1)) LIMIT 1`,
    [TENANT_B_SLUG]
  );
  if (existing.rows[0]?.id) {
    return existing.rows[0].id;
  }

  const ins = await client.query<{ id: string }>(
    `INSERT INTO automacao.tenants (slug, nome, ativo)
     VALUES ($1, $2, true)
     RETURNING id::text AS id`,
    [TENANT_B_SLUG, "Escritorio proc cross-test"]
  );
  const id = ins.rows[0]?.id;
  if (!id) {
    throw new Error("Falha ao criar automacao tenant B.");
  }
  return id;
}

async function ensureMembershipBothTenants(
  client: pg.Client,
  tenantA: string,
  tenantB: string
): Promise<void> {
  const user = await client.query<{ id: string }>(
    `SELECT id::text AS id FROM portal.app_user WHERE lower(email) = lower($1) LIMIT 1`,
    [SEED_PORTAL_EMAIL]
  );
  const userId = user.rows[0]?.id;
  if (!userId) {
    throw new Error("Usuario seed portal ausente.");
  }

  for (const tenantId of [tenantA, tenantB]) {
    await client.query(
      `INSERT INTO portal.membership (app_user_id, tenant_id, role)
       VALUES ($1::uuid, $2, 'admin_escritorio')
       ON CONFLICT DO NOTHING`,
      [userId, tenantId]
    );
  }
}

async function ensureBillingLinkTenantB(client: pg.Client, tenantB: string): Promise<void> {
  await client.query(
    `INSERT INTO portal.billing_tenant_link (automacao_tenant_id, public_tenant_id)
     VALUES ($1, $2::uuid)
     ON CONFLICT (automacao_tenant_id) DO UPDATE
       SET public_tenant_id = EXCLUDED.public_tenant_id`,
    [tenantB, OTHER_PUBLIC_TENANT_UUID]
  );
}
