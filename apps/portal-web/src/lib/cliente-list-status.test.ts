import { describe, expect, it } from "vitest";
import { resolveClienteListStatus } from "./cliente-list-status";

const enderecoOk = {
  cep: "01310100",
  logradouro: "Av Paulista",
  numero: "1000",
  complemento: null,
  bairro: "Bela Vista",
  cidade: "Sao Paulo",
  uf: "SP"
};

describe("resolveClienteListStatus", () => {
  it("erro_emissao + endereco completo + gateway exige endereco → Reemitir (nao Atenção)", () => {
    const r = resolveClienteListStatus({
      cliente: { endereco: enderecoOk },
      topCharge: { id: "ch-1", canonicalStatus: "erro_emissao" },
      gatewayRequiresPayerAddress: true
    });
    expect(r.statusLabel).toBe("Reemitir");
    expect(r.statusPill).toBe("programado");
    expect(r.reprocessChargeId).toBe("ch-1");
  });

  it("erro_emissao + endereco incompleto → Atenção", () => {
    const r = resolveClienteListStatus({
      cliente: { endereco: null },
      topCharge: { id: "ch-1", canonicalStatus: "erro_emissao" },
      gatewayRequiresPayerAddress: true
    });
    expect(r.statusLabel).toBe("Atenção");
    expect(r.statusPill).toBe("atencao");
    expect(r.reprocessChargeId).toBeNull();
  });

  it("erro_emissao + endereco completo + Asaas (sem exigencia) → Atenção", () => {
    const r = resolveClienteListStatus({
      cliente: { endereco: enderecoOk },
      topCharge: { id: "ch-1", canonicalStatus: "erro_emissao" },
      gatewayRequiresPayerAddress: false
    });
    expect(r.statusLabel).toBe("Atenção");
    expect(r.statusPill).toBe("atencao");
  });

  it("vencida → Cobrança", () => {
    const r = resolveClienteListStatus({
      cliente: { endereco: null },
      topCharge: { id: "ch-2", canonicalStatus: "vencida" },
      gatewayRequiresPayerAddress: true
    });
    expect(r.statusLabel).toBe("Cobrança");
    expect(r.statusPill).toBe("cobranca");
  });
});
