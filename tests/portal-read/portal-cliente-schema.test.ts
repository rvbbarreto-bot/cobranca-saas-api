import { describe, expect, it } from "vitest";
import {
  isPortalClienteEnderecoColumnMissing,
  PortalClienteSchemaMigrationError,
  rethrowPortalClienteSchemaError
} from "../../src/modules/portal-read/infrastructure/portal-cliente-schema";

describe("portal-cliente-schema", () => {
  it("detecta coluna endereco ausente em portal.cliente", () => {
    const err = Object.assign(new Error('column "endereco_cep" of relation "cliente" does not exist'), {
      code: "42703"
    });
    expect(isPortalClienteEnderecoColumnMissing(err)).toBe(true);
  });

  it("ignora outros erros postgres", () => {
    const err = Object.assign(new Error('column "foo" does not exist'), { code: "42703" });
    expect(isPortalClienteEnderecoColumnMissing(err)).toBe(false);
  });

  it("rethrow mapeia para PortalClienteSchemaMigrationError", () => {
    const err = Object.assign(new Error('column "endereco_uf" of relation "cliente" does not exist'), {
      code: "42703"
    });
    expect(() => rethrowPortalClienteSchemaError(err)).toThrow(PortalClienteSchemaMigrationError);
  });
});
