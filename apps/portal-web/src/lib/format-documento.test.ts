import { describe, expect, it } from "vitest";
import { formatDocumentoDisplay } from "./format-documento";

describe("formatDocumentoDisplay", () => {
  it("formata CPF com 11 dígitos", () => {
    expect(formatDocumentoDisplay("12345678901")).toBe("123.456.789-01");
  });

  it("formata CNPJ com 14 dígitos", () => {
    expect(formatDocumentoDisplay("12345678000199")).toBe("12.345.678/0001-99");
  });

  it("retorna texto original quando tamanho inválido", () => {
    expect(formatDocumentoDisplay("  ABC  ")).toBe("ABC");
  });
});
