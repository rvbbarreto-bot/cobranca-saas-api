import { describe, expect, it } from "vitest";
import { emissionAddressBlockMessage, isCompleteClienteEmissionAddress } from "./cliente-emission-address";

describe("isCompleteClienteEmissionAddress", () => {
  it("emissionAddressBlockMessage inclui gateway", () => {
    expect(emissionAddressBlockMessage("Banco Inter")).toMatch(/Banco Inter/);
  });

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
