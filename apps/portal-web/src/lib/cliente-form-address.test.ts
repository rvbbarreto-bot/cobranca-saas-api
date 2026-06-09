import { describe, expect, it } from "vitest";
import { buildClienteEnderecoPayload } from "./cliente-form-address";

const empty = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  uf: ""
};

describe("buildClienteEnderecoPayload", () => {
  it("nao envia endereco quando secao vazia", () => {
    expect(buildClienteEnderecoPayload(empty)).toEqual({});
  });

  it("monta endereco completo", () => {
    const r = buildClienteEnderecoPayload({
      cep: "01310-100",
      logradouro: "Av Paulista",
      numero: "1000",
      complemento: "Sala 1",
      bairro: "Bela Vista",
      cidade: "Sao Paulo",
      uf: "SP"
    });
    expect(r.fieldErrors).toBeUndefined();
    expect(r.endereco).toEqual({
      cep: "01310100",
      logradouro: "Av Paulista",
      numero: "1000",
      complemento: "Sala 1",
      bairro: "Bela Vista",
      cidade: "Sao Paulo",
      uf: "SP"
    });
  });

  it("rejeita endereco parcial (ex.: CEP sem bairro)", () => {
    const r = buildClienteEnderecoPayload({
      ...empty,
      cep: "01310100",
      logradouro: "Av Paulista",
      cidade: "Sao Paulo",
      uf: "SP"
    });
    expect(r.endereco).toBeUndefined();
    expect(r.fieldErrors?.endereco).toMatch(/bairro/i);
  });
});
