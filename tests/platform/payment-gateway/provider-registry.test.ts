import { describe, expect, it } from "vitest";
import { GATEWAY_REGISTRY, listAvailableProviders } from "../../../src/platform/payment-gateway/provider-registry";

describe("provider-registry", () => {
  it("Inter e Cora possuem campos obrigatorios", () => {
    const inter = GATEWAY_REGISTRY.inter;
    const cora = GATEWAY_REGISTRY.cora;
    expect(inter.credentialFields.map((f) => f.key)).toEqual(
      expect.arrayContaining(["client_id", "client_secret", "certificate_pem", "private_key_pem"])
    );
    expect(cora.credentialFields.map((f) => f.key)).toEqual(
      expect.arrayContaining(["client_id", "certificate_pem", "private_key_pem"])
    );
    expect(inter.supportsBoleto).toBe(true);
    expect(cora.supportsPix).toBe(true);
  });

  it("lista apenas providers habilitados", () => {
    const ids = listAvailableProviders().map((p) => p.id);
    expect(ids).toContain("asaas");
    expect(ids).toContain("inter");
    expect(ids).toContain("cora");
    expect(ids).toContain("c6");
    expect(ids).not.toContain("bb");
  });
});
