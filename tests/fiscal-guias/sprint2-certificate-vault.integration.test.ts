import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/app";
import {
  runSeedPortalHappyPath,
  SEED_PORTAL_DEFAULT_PASSWORD,
  SEED_PORTAL_EMAIL,
  SEED_AUTOMACAO_SLUG
} from "../../src/dev/seed-portal-happy-path";
import { ensureOrganizationForEscritorio } from "../../src/modules/exeq-platform/infrastructure/organization-repository";
import { closePool, getPool } from "../../src/platform/persistence/pool";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());
const TEST_CNPJ = "55443322100010";

const FAKE_CERT =
  "-----BEGIN CERTIFICATE-----\n" + "C".repeat(120) + "\n-----END CERTIFICATE-----";
const FAKE_KEY =
  "-----BEGIN PRIVATE KEY-----\n" + "D".repeat(120) + "\n-----END PRIVATE KEY-----";

async function assertVaultSchemaReady(): Promise<void> {
  const pool = getPool();
  await pool.query("SELECT 1");
  const r = await pool.query<{ ok: boolean }>(
    `SELECT to_regclass('fiscal.certificate_vault') IS NOT NULL AS ok`
  );
  if (!r.rows[0]?.ok) {
    throw new Error("Execute npm run migrate (033) e npm run backfill:organization");
  }
}

describe.skipIf(!hasDb)("Sprint 2 — certificate vault (EXEQ-FISC-020/021)", () => {
  let app: ReturnType<typeof createApp>;
  let tenantId = "";
  let portalClienteId = "";
  let adminToken = "";
  const previousFlag = process.env.FISCAL_GUIAS_ENABLED;
  const previousEnc = process.env.ENCRYPTION_KEY;

  beforeAll(async () => {
    process.env.FISCAL_GUIAS_ENABLED = "true";
    process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY?.trim() || "a".repeat(64);
    await assertVaultSchemaReady();

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
         RETURNING id::text AS id`,
        [tenantId, TEST_CNPJ, "Empresa Vault S2", "vault-s2@local.dev"]
      );
      portalClienteId = ins.rows[0]!.id;

      await client.query(
        `DELETE FROM fiscal.certificate_vault WHERE automacao_tenant_id = $1 AND portal_cliente_id = $2::uuid`,
        [tenantId, portalClienteId]
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

  it("POST certificado persiste em certificate_vault com certificate_vault_id na resposta", async () => {
    const res = await request(app)
      .post("/v1/portal/fiscal/certificados")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .send({
        portal_cliente_id: portalClienteId,
        label: "A1 Vault S2",
        valid_from: "2026-01-01",
        valid_until: "2027-06-01",
        certificado_pem: FAKE_CERT,
        chave_privada_pem: FAKE_KEY
      })
      .expect(201);

    expect(res.body.certificado.certificate_vault_id).toBeTruthy();
    expect(res.body.certificado.certificate_vault_id).toBe(res.body.certificado.id);

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL!.trim() });
    await client.connect();
    try {
      const vault = await client.query<{ id: string; org: string }>(
        `SELECT id::text AS id, organization_id::text AS org
         FROM fiscal.certificate_vault
         WHERE id = $1::uuid`,
        [res.body.certificado.certificate_vault_id]
      );
      expect(vault.rows[0]?.id).toBe(res.body.certificado.certificate_vault_id);
      expect(vault.rows[0]?.org).toBeTruthy();
    } finally {
      await client.end();
    }
  });

  it("GET certificado le do vault (sem PEM)", async () => {
    const res = await request(app)
      .get("/v1/portal/fiscal/certificados")
      .query({ portal_cliente_id: portalClienteId })
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-tenant-id", tenantId)
      .expect(200);

    expect(res.body.certificado.label).toBe("A1 Vault S2");
    expect(res.body.certificado.certificate_vault_id).toBeTruthy();
    expect(res.body.certificado).not.toHaveProperty("certificado_pem");
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
