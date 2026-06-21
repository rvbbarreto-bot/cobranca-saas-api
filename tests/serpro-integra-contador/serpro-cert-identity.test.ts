import { describe, expect, it, vi } from "vitest";

vi.mock("node:crypto", async (importOriginal) => {
  const mod = await importOriginal<typeof import("node:crypto")>();
  return {
    ...mod,
    X509Certificate: vi.fn().mockImplementation(() => ({
      subject: "CN=RICARDO VITORIANO BARRETO:37229907000137"
    }))
  };
});

import { parseIcpBrasilCertIdentity } from "../../src/modules/serpro-integra-contador/infrastructure/serpro-cert-identity";

describe("parseIcpBrasilCertIdentity", () => {
  it("extrai CNPJ e nome do CN ICP-Brasil", () => {
    const id = parseIcpBrasilCertIdentity("-----BEGIN CERTIFICATE-----\nTEST\n-----END CERTIFICATE-----");
    expect(id.documento).toBe("37229907000137");
    expect(id.documentoTipo).toBe("PJ");
    expect(id.nome).toBe("RICARDO VITORIANO BARRETO");
  });
});
