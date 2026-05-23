import { describe, expect, it } from "vitest";
import {
  mapRowToCustomerAddress,
  parsePortalClienteEnderecoBody
} from "../../src/modules/portal-read/application/portal-cliente-address";

describe("portal-cliente-address", () => {
  it("mapeia linha do banco para CustomerAddressInput", () => {
    const addr = mapRowToCustomerAddress({
      endereco_cep: "01310100",
      endereco_logradouro: "Av Paulista",
      endereco_numero: "1000",
      endereco_complemento: null,
      endereco_bairro: "Bela Vista",
      endereco_cidade: "Sao Paulo",
      endereco_uf: "sp"
    });
    expect(addr).toEqual({
      cep: "01310100",
      logradouro: "Av Paulista",
      numero: "1000",
      bairro: "Bela Vista",
      cidade: "Sao Paulo",
      uf: "SP"
    });
  });

  it("retorna undefined quando CEP incompleto", () => {
    expect(
      mapRowToCustomerAddress({
        endereco_cep: null,
        endereco_logradouro: "Rua A",
        endereco_numero: null,
        endereco_complemento: null,
        endereco_bairro: "Centro",
        endereco_cidade: "SP",
        endereco_uf: "SP"
      })
    ).toBeUndefined();
  });

  it("valida endereco no body", () => {
    const ok = parsePortalClienteEnderecoBody({
      cep: "01310-100",
      logradouro: "Av Paulista",
      bairro: "Bela Vista",
      cidade: "Sao Paulo",
      uf: "SP"
    });
    expect(ok.ok).toBe(true);
  });
});
