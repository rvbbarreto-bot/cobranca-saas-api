import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/app";
import {
  runSeedPortalHappyPath,
  SEED_PORTAL_DEFAULT_PASSWORD,
  SEED_PORTAL_EMAIL
} from "../../src/dev/seed-portal-happy-path";
import { closePool, getPool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const TEST_CNPJ = "77665544332211";

async function fiscalSchemaReady(): Promise<boolean> {
  const pool = getPool();
  const r = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('fiscal.guia_fiscal') IS NOT NULL AS ok`
  );
  return Boolean(r.rows[0]?.ok);
}

describe.skipIf(!hasDb)("Fiscal — GET portal guias filtros DAS/DARF", () => {
  let app: ReturnType<typeof createApp>;
  let automacaoTenantId = "";
  let token = "";
  let guiaDasId = "";
  let guiaDarfId = "";
  const competenciaDas = "2095-03";
  const competenciaDarf = "2095-04";
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";

    if (!(await fiscalSchemaReady())) {
      return;
    }

    app = createApp();
    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    automacaoTenantId = seed.automacaoTenantId;

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    try {
      const portalClienteId = await insertPortalCliente(client, automacaoTenantId);
      guiaDasId = await insertGuia(client, automacaoTenantId, portalClienteId, "DAS", competenciaDas);
      guiaDarfId = await insertGuia(client, automacaoTenantId, portalClienteId, "DARF", competenciaDarf);
    } finally {
      await client.end();
    }

    const login = await request(app)
      .post("/v1/portal/auth/login")
      .send({
        email: SEED_PORTAL_EMAIL,
        tenant_id: automacaoTenantId,
        password: SEED_PORTAL_DEFAULT_PASSWORD
      });
    token = login.body.access_token as string;
  });

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.FISCAL_GUIAS_ENABLED;
    else process.env.FISCAL_GUIAS_ENABLED = previousFlag;
    await closePool();
  });

  it("lista apenas guias DAS quando tipo_guia=DAS", async (ctx) => {
    if (!token || !guiaDasId) ctx.skip();

    const res = await request(app)
      .get("/v1/portal/fiscal/guias?tipo_guia=DAS&competencia=2095-03")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", automacaoTenantId)
      .expect(200);

    const guias = res.body.guias as { id: string; tipo_guia: string }[];
    expect(guias.some((g) => g.id === guiaDasId)).toBe(true);
    expect(guias.every((g) => g.tipo_guia === "DAS")).toBe(true);
    expect(guias.some((g) => g.id === guiaDarfId)).toBe(false);
  });

  it("lista apenas guias DARF quando tipo_guia=DARF", async (ctx) => {
    if (!token || !guiaDarfId) ctx.skip();

    const res = await request(app)
      .get("/v1/portal/fiscal/guias?tipo_guia=DARF&competencia=2095-04")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", automacaoTenantId)
      .expect(200);

    const guias = res.body.guias as { id: string; tipo_guia: string }[];
    expect(guias.some((g) => g.id === guiaDarfId)).toBe(true);
    expect(guias.every((g) => g.tipo_guia === "DARF")).toBe(true);
  });

  it("filtra por competencia sem tipo", async (ctx) => {
    if (!token) ctx.skip();

    const res = await request(app)
      .get("/v1/portal/fiscal/guias?competencia=2095-04")
      .set("Authorization", `Bearer ${token}`)
      .set("x-tenant-id", automacaoTenantId)
      .expect(200);

    const guias = res.body.guias as { competencia: string }[];
    expect(guias.every((g) => g.competencia === "2095-04")).toBe(true);
  });
});

async function insertPortalCliente(client: pg.Client, tenantId: string): Promise<string> {
  const ins = await client.query<{ id: string }>(
    `INSERT INTO portal.cliente (tenant_id, documento, tipo_documento, nome, email)
     VALUES ($1, $2, 'cnpj', $3, $4)
     ON CONFLICT (tenant_id, documento) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id::text AS id`,
    [tenantId, TEST_CNPJ, "Empresa Filtro Portal", "filtro-portal@local.dev"]
  );
  return ins.rows[0]!.id;
}

async function insertGuia(
  client: pg.Client,
  tenantId: string,
  portalClienteId: string,
  tipo: "DAS" | "DARF",
  competencia: string
): Promise<string> {
  const idem = `portal-filter-${tipo.toLowerCase()}-${tenantId.slice(0, 8)}-${competencia}`;
  const ins = await client.query<{ id: string }>(
    `INSERT INTO fiscal.guia_fiscal (
       tenant_id, portal_cliente_id, tipo_guia, competencia,
       valor_principal, idempotency_key, status, compliance_status
     )
     VALUES ($1, $2::uuid, $3, $4, 200.00, $5, 'DISPONIVEL', 'aprovado')
     ON CONFLICT (tenant_id, idempotency_key) DO UPDATE SET updated_at = now()
     RETURNING id::text AS id`,
    [tenantId, portalClienteId, tipo, competencia, idem]
  );
  return ins.rows[0]!.id;
}
