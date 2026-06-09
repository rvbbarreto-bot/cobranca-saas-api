/** Politica de rate limit — upload CSV PGDASD (EXEQ-FISC-095). */
export const FISCAL_CSV_INGEST_RATE_LIMIT = {
  windowMs: 60_000,
  /** Uploads por tenant autenticado por minuto. */
  maxPerTenant: 10
} as const;
