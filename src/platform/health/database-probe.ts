import type { Pool } from "pg";

export type DatabaseProbeChecks = {
  selectOne: boolean;
  pgcrypto: boolean;
  tablePublicTenants: boolean;
  tablePublicCharges: boolean;
  tablePortalAppUser: boolean;
  portalClienteEndereco: boolean;
};

export type DatabaseProbeResult = {
  ok: boolean;
  latencyMs: number;
  checks: DatabaseProbeChecks;
  error?: string;
};

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label}: timeout ${ms}ms`)), ms);
    promise
      .then((v) => {
        clearTimeout(t);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(t);
        reject(e);
      });
  });
}

/**
 * Executa ping + objetos minimos esperados apos migracoes do pacote cobranca-saas-api.
 * Usado por GET /health/ready e pelo script `npm run check:db`.
 */
export async function probeDatabase(pool: Pool, timeoutMs: number): Promise<DatabaseProbeResult> {
  const started = Date.now();
  const checks: DatabaseProbeChecks = {
    selectOne: false,
    pgcrypto: false,
    tablePublicTenants: false,
    tablePublicCharges: false,
    tablePortalAppUser: false,
    portalClienteEndereco: false
  };

  try {
    await withTimeout(pool.query("SELECT 1 AS ok"), timeoutMs, "SELECT 1");
    checks.selectOne = true;

    const ext = await withTimeout(
      pool.query(`SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') AS ok`),
      timeoutMs,
      "pgcrypto"
    );
    checks.pgcrypto = Boolean((ext.rows[0] as { ok?: boolean } | undefined)?.ok);

    const tables = await withTimeout(
      pool.query(
        `SELECT
           to_regclass('public.tenants') IS NOT NULL AS tenants,
           to_regclass('public.charges') IS NOT NULL AS charges,
           to_regclass('portal.app_user') IS NOT NULL AS portal_app_user`
      ),
      timeoutMs,
      "schema_objects"
    );
    const row = (tables.rows[0] as { tenants?: boolean; charges?: boolean; portal_app_user?: boolean } | undefined) ?? {};
    checks.tablePublicTenants = Boolean(row.tenants);
    checks.tablePublicCharges = Boolean(row.charges);
    checks.tablePortalAppUser = Boolean(row.portal_app_user);

    const enderecoCol = await withTimeout(
      pool.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'portal' AND table_name = 'cliente' AND column_name = 'endereco_cep'
         ) AS ok`
      ),
      timeoutMs,
      "portal_cliente_endereco"
    );
    checks.portalClienteEndereco = Boolean((enderecoCol.rows[0] as { ok?: boolean } | undefined)?.ok);

    const ok =
      checks.selectOne &&
      checks.pgcrypto &&
      checks.tablePublicTenants &&
      checks.tablePublicCharges &&
      checks.tablePortalAppUser &&
      checks.portalClienteEndereco;

    return {
      ok,
      latencyMs: Date.now() - started,
      checks,
      error: ok ? undefined : "Um ou mais checks de schema/extensao falharam."
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      latencyMs: Date.now() - started,
      checks,
      error: message
    };
  }
}
