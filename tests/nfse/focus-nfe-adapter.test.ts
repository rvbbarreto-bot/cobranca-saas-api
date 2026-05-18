import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FocusNFeAdapter } from "../../src/modules/nfse/infrastructure/focus-nfe/focus-nfe-adapter";
import { NfseError } from "../../src/modules/nfse/domain/nfse-error";

const baseInput = {
  referencia: "charge-uuid-1",
  prestador: {
    cnpj: "12345678000199",
    inscricaoMunicipal: "12345",
    codigoMunicipio: "3550308",
    regimeTributario: 1 as const
  },
  tomador: {
    cpfCnpj: "12345678901",
    razaoSocial: "Cliente Teste",
    email: "cliente@teste.com"
  },
  servico: {
    valor: 100.5,
    issRetido: false,
    itemListaServico: "01.07",
    discriminacao: "Servico de cobranca",
    codigoMunicipio: "3550308",
    aliquota: 2
  },
  dataEmissao: "2026-05-18T10:00:00-03:00"
};

describe("FocusNFeAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emitir() → POST correto e retorna NfseResult", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({
        status: "autorizado",
        numero: "123",
        codigo_verificacao: "ABC",
        url: "https://focus/pdf/1",
        caminho_xml_nota_fiscal: "https://focus/xml/1"
      })
    } as Response);

    const adapter = new FocusNFeAdapter("focus-token");
    const result = await adapter.emitir(baseInput);

    expect(result.numeroNfse).toBe("123");
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v2/nfse?ref=charge-uuid-1"),
      expect.objectContaining({ method: "POST" })
    );
  });

  it("emitir() com erro 422 → NfseError unrecoverable=true", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ erros: [{ mensagem: "CNPJ invalido" }] })
    } as Response);

    const adapter = new FocusNFeAdapter("focus-token");
    await expect(adapter.emitir(baseInput)).rejects.toMatchObject({
      name: "NfseError",
      unrecoverable: true,
      statusCode: 422
    } satisfies Partial<NfseError>);
  });

  it("consultar() → mapeia processando → emitindo", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "processando" })
    } as Response);

    const adapter = new FocusNFeAdapter("focus-token");
    const result = await adapter.consultar("charge-uuid-1");
    expect(result.status).toBe("emitindo");
  });

  it("cancelar() → DELETE com justificativa", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, status: 204 } as Response);

    const adapter = new FocusNFeAdapter("focus-token");
    await adapter.cancelar("charge-uuid-1", "Motivo teste");

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "DELETE" })
    );
    const url = String(vi.mocked(fetch).mock.calls[0]?.[0]);
    expect(url).toContain("justificativa=");
  });
});
