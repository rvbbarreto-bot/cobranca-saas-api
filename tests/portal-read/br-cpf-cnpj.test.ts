import { describe, expect, it } from "vitest";
import {
  buildCnpjFrom12BaseDigits,
  isValidBrTaxIdDigits,
  isValidCnpjDigits,
  isValidCpfDigits,
  uniqueTestCnpj
} from "../../src/modules/portal-read/application/br-cpf-cnpj";

describe("isValidCpfDigits", () => {
  it("aceita CPF com DV correto", () => {
    expect(isValidCpfDigits("39053344705")).toBe(true);
    expect(isValidCpfDigits("52998224725")).toBe(true);
  });
  it("rejeita sequencia repetida", () => {
    expect(isValidCpfDigits("11111111111")).toBe(false);
  });
  it("rejeita DV incorreto", () => {
    expect(isValidCpfDigits("12345678901")).toBe(false);
  });
});

describe("isValidCnpjDigits", () => {
  it("aceita CNPJ com DV correto", () => {
    expect(isValidCnpjDigits("11222333000181")).toBe(true);
  });
  it("rejeita DV incorreto", () => {
    expect(isValidCnpjDigits("11222333000180")).toBe(false);
  });
});

describe("isValidBrTaxIdDigits", () => {
  it("delega por tamanho", () => {
    expect(isValidBrTaxIdDigits("39053344705")).toBe(true);
    expect(isValidBrTaxIdDigits("11222333000181")).toBe(true);
  });
});

describe("buildCnpjFrom12BaseDigits / uniqueTestCnpj", () => {
  it("reconstrói CNPJ conhecido da suite", () => {
    expect(buildCnpjFrom12BaseDigits("112223330001")).toBe("11222333000181");
    expect(isValidCnpjDigits(buildCnpjFrom12BaseDigits("112223330001"))).toBe(true);
  });

  it("uniqueTestCnpj gera CNPJ valido", () => {
    const c = uniqueTestCnpj(Date.now(), 0);
    expect(c).toHaveLength(14);
    expect(isValidCnpjDigits(c)).toBe(true);
  });
});
