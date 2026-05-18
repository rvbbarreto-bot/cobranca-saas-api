/**
 * Heuristica para URL Postgres com TLS explicito (readiness / pre-deploy).
 * Nao substitui analise de infra; evita deploy com URL "sem ssl" em producao por engano.
 */

export function databaseUrlIndicatesTls(connectionString: string): boolean {
  const u = connectionString.trim().toLowerCase();
  return (
    u.includes("sslmode=require") ||
    u.includes("sslmode=verify-full") ||
    u.includes("sslmode=verify-ca") ||
    /[?&]ssl=true(?:&|$)/.test(u)
  );
}

/** Em checagens de producao, exige indicacao de TLS na URL salvo bypass explicito. */
export function shouldEnforceDatabaseTlsInChecks(): boolean {
  const raw = process.env.ALLOW_INSECURE_DATABASE_URL?.trim().toLowerCase();
  if (raw === "1" || raw === "true" || raw === "yes") {
    return false;
  }
  return process.env.NODE_ENV === "production";
}
