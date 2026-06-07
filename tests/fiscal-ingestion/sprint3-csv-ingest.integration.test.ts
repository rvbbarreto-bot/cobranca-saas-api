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
import { closePool, getPool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const TEST_CNPJ = "00000000000191";

async function assertIngestSchemaReady(): Promise<void> {
  const pool = getPool();
  await pool.query("SELECT 1");
  const r = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('fiscal.fiscal_ingest') IS NOT NULL AS ok`
  );
  if (!r.rows[0]?.ok) {
    throw new Error("Execute npm run migrate (034_fiscal_ingest.sql)");
  }
}

describe.skipIf(!hasDb)("Sprint 3 — ingestao CSV PGDASD", () => {
  let app: ReturnType<typeof createApp>;
  let tenantId = "";
  let adminToken = "";
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;
  const previousEnc = process.env.ENCRYPTION_KEY;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY?.trim() || "a".repeat(64);
    await assertIngestSchemaReady();

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
    if (previousEnc === undefined) delete process.env.ENCRYPTION_KEY;
    else process.env.ENCRYPTION_KEY = previousEnc;
    await closePool().catch(() => undefined);
  });

  it("POST csv → VALIDADO com canonical_rows", async () => {
    const csv = readFileSync(join(process.cwd(), "docs/templates/pgdasd-import-v1.csv"), "utf8");

    const post = await request(app)
      .post("/v1/portal/fiscal/ingest/csv")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .attach("file", Buffer.from(csv, "utf8"), "pgdasd-import-v1.csv")
      .expect(202);

    const ingestId = post.body.ingest.id as string;
    expect(post.body.ingest.status).toBe("VALIDANDO");

    await processFiscalIngestValidateJob({ ingestId, automacaoTenantId: tenantId });

    const get = await request(app)
      .get(`/v1/portal/fiscal/ingest/${ingestId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(get.body.ingest.status).toBe("VALIDADO");
    expect(get.body.ingest.valid_count).toBe(1);
    expect(get.body.ingest.canonical_rows[0]?.cnpj).toBe(TEST_CNPJ);
    expect(get.body.ingest.canonical_rows[0]?.portal_cliente_id).toBeTruthy();
  });

  it("POST csv invalido retorna ERRO na consulta", async () => {
    const csv = "cnpj,competencia\nbad,2026-05";

    const post = await request(app)
      .post("/v1/portal/fiscal/ingest/csv")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .attach("file", Buffer.from(csv, "utf8"), "invalid.csv")
      .expect(202);

    const ingestId = post.body.ingest.id as string;
    await processFiscalIngestValidateJob({ ingestId, automacaoTenantId: tenantId });

    const get = await request(app)
      .get(`/v1/portal/fiscal/ingest/${ingestId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(get.body.ingest.status).toBe("ERRO");
    expect(get.body.ingest.validation_errors.length).toBeGreaterThan(0);
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
