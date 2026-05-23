import { describe, expect, it } from "vitest";
import {
  isCompletePayerAddress,
  requirePayerAddress
} from "../../src/modules/payment-gateway/domain/require-payer-address";

describe("require-payer-address", () => {
  it("isCompletePayerAddress aceita endereco valido", () => {
    expect(
      isCompletePayerAddress({
        cep: "01310100",
        logradouro: "Av Paulista",
        bairro: "Bela Vista",
        cidade: "Sao Paulo",
        uf: "SP"
      })
    ).toBe(true);
  });

  it("requirePayerAddress rejeita endereco incompleto", () => {
    expect(() => requirePayerAddress("inter", undefined)).toThrowError(/obrigatorio/i);
  });
});
