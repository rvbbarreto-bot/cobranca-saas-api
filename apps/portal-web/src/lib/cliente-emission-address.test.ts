import { describe, expect, it } from "vitest";
import { isCompleteClienteEmissionAddress } from "./cliente-emission-address";

describe("isCompleteClienteEmissionAddress", () => {
  it("aceita endereco completo", () => {
    expect(
      isCompleteClienteEmissionAddress({
        cep: "01310100",
        logradouro: "Av Paulista",
        numero: "1000",
        complemento: null,
        bairro: "Bela Vista",
        cidade: "Sao Paulo",
        uf: "SP"
      })
    ).toBe(true);
  });

  it("rejeita sem bairro", () => {
    expect(
      isCompleteClienteEmissionAddress({
        cep: "01310100",
        logradouro: "Av Paulista",
        numero: null,
        complemento: null,
        bairro: "",
        cidade: "Sao Paulo",
        uf: "SP"
      })
    ).toBe(false);
  });
});
