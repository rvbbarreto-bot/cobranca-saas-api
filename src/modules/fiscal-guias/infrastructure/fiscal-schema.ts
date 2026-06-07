/** DB sem migration 028 (schema fiscal). */
export class FiscalGuiasSchemaMigrationError extends Error {
  readonly migrationFile = "028_fiscal_guias_fase0.sql";

  constructor() {
    super("Schema fiscal ausente. Execute npm run migrate (028_fiscal_guias_fase0.sql).");
    this.name = "FiscalGuiasSchemaMigrationError";
  }
}

function pgErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

function pgErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return "";
}

export function isFiscalGuiaTableMissing(error: unknown): boolean {
  const code = pgErrorCode(error);
  if (code !== "42P01" && code !== "3F000") {
    return false;
  }
  const msg = pgErrorMessage(error);
  return /fiscal\.guia_fiscal/i.test(msg) || (/guia_fiscal/i.test(msg) && /fiscal/i.test(msg));
}

export function rethrowFiscalSchemaError(error: unknown): never {
  if (isFiscalGuiaTableMissing(error)) {
    throw new FiscalGuiasSchemaMigrationError();
  }
  throw error;
}
