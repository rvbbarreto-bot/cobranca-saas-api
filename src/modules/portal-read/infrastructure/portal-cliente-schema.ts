/** DB sem migration 027 (colunas endereco em portal.cliente). */
export class PortalClienteSchemaMigrationError extends Error {
  readonly migrationFile = "027_portal_cliente_endereco.sql";

  constructor() {
    super(
      "Schema portal.cliente desatualizado. Execute npm run migrate (027_portal_cliente_endereco.sql)."
    );
    this.name = "PortalClienteSchemaMigrationError";
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

export function isPortalClienteEnderecoColumnMissing(error: unknown): boolean {
  if (pgErrorCode(error) !== "42703") {
    return false;
  }
  const msg = pgErrorMessage(error);
  return /endereco_/i.test(msg) && /cliente/i.test(msg);
}

export function rethrowPortalClienteSchemaError(error: unknown): never {
  if (isPortalClienteEnderecoColumnMissing(error)) {
    throw new PortalClienteSchemaMigrationError();
  }
  throw error;
}
