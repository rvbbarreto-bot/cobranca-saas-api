import type {
  EmitirNfseInput,
  NfseConsultaStatus,
  NfseGatewayAdapter,
  NfseResult
} from "../../domain/nfse-gateway.interface";
import { NfseError } from "../../domain/nfse-error";

const TIMEOUT_MS = 20_000;

export function mapRegimeTributarioToFocus(
  regime: string | null | undefined
): 1 | 3 | 5 {
  if (regime === "presumido") return 3;
  if (regime === "real") return 5;
  return 1;
}

function basicAuthHeader(token: string): string {
  return `Basic ${Buffer.from(`${token}:`).toString("base64")}`;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new NfseError(`Focus NFe timeout após ${timeoutMs}ms`, "FOCUS_TIMEOUT", undefined, false);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function mapFocusStatus(raw: string | undefined): NfseConsultaStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "autorizado") return "autorizado";
  if (s === "cancelado") return "cancelado";
  if (s === "erro" || s === "rejeitado") return "erro";
  return "emitindo";
}

function buildEmitBody(input: EmitirNfseInput): Record<string, unknown> {
  const body: Record<string, unknown> = {
    data_emissao: input.dataEmissao,
    natureza_operacao: 1,
    optante_simples_nacional: input.prestador.regimeTributario === 1,
    prestador: {
      cnpj: input.prestador.cnpj,
      inscricao_municipal: input.prestador.inscricaoMunicipal,
      codigo_municipio: input.prestador.codigoMunicipio
    },
    tomador: {
      cpf: input.tomador.cpfCnpj.length === 11 ? input.tomador.cpfCnpj : undefined,
      cnpj: input.tomador.cpfCnpj.length === 14 ? input.tomador.cpfCnpj : undefined,
      razao_social: input.tomador.razaoSocial,
      email: input.tomador.email,
      telefone: input.tomador.telefone
    },
    servico: {
      aliquota: input.servico.aliquota,
      discriminacao: input.servico.discriminacao,
      iss_retido: input.servico.issRetido,
      item_lista_servico: input.servico.itemListaServico,
      codigo_municipio: input.servico.codigoMunicipio,
      valor_servicos: input.servico.valor,
      codigo_cnae: input.servico.codigoCnae,
      valor_deducoes: input.servico.valorDeducoes
    }
  };
  if (input.tomador.endereco) {
    (body.tomador as Record<string, unknown>).endereco = {
      logradouro: input.tomador.endereco.logradouro,
      numero: input.tomador.endereco.numero,
      bairro: input.tomador.endereco.bairro,
      codigo_municipio: input.tomador.endereco.codigoMunicipio,
      uf: input.tomador.endereco.uf,
      cep: input.tomador.endereco.cep
    };
  }
  return body;
}

function parseEmitResponse(payload: Record<string, unknown>): NfseResult {
  const status = mapFocusStatus(String(payload.status ?? ""));
  if (status === "erro") {
    const msg =
      String(payload.mensagem ?? payload.mensagem_sefaz ?? payload.erros ?? "Erro Focus NFe");
    throw new NfseError(msg, "FOCUS_EMIT_ERROR", undefined, true);
  }
  return {
    numeroNfse: String(payload.numero ?? payload.numero_nfse ?? ""),
    codigoVerificacao: String(payload.codigo_verificacao ?? ""),
    pdfUrl: String(payload.url ?? payload.url_danfse ?? payload.pdf_url ?? ""),
    xmlUrl: String(payload.caminho_xml_nota_fiscal ?? payload.xml_url ?? ""),
    emitidoEm: payload.data_emissao ? new Date(String(payload.data_emissao)) : new Date()
  };
}

export class FocusNFeAdapter implements NfseGatewayAdapter {
  constructor(
    private readonly token: string,
    private readonly baseUrl = process.env.FOCUS_NFE_URL?.trim() ||
      "https://homologacao.focusnfe.com.br"
  ) {}

  async emitir(input: EmitirNfseInput): Promise<NfseResult> {
    const base = this.baseUrl.replace(/\/$/, "");
    const url = `${base}/v2/nfse?ref=${encodeURIComponent(input.referencia)}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          Authorization: basicAuthHeader(this.token),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(buildEmitBody(input))
      },
      TIMEOUT_MS
    );

    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;

    if (res.status === 422) {
      const erros = payload.erros as Array<{ mensagem?: string }> | undefined;
      const msg = erros?.[0]?.mensagem ?? String(payload.mensagem ?? "validation_error");
      throw new NfseError(msg, "FOCUS_VALIDATION", 422, true);
    }
    if (res.status >= 400 && res.status < 500) {
      throw new NfseError(
        String(payload.mensagem ?? `Focus NFe HTTP ${res.status}`),
        "FOCUS_CLIENT_ERROR",
        res.status,
        true
      );
    }
    if (res.status >= 500) {
      throw new NfseError(
        String(payload.mensagem ?? `Focus NFe HTTP ${res.status}`),
        "FOCUS_SERVER_ERROR",
        res.status,
        false
      );
    }

    return parseEmitResponse(payload);
  }

  async consultar(referencia: string): Promise<{
    status: NfseConsultaStatus;
    numeroNfse?: string;
    pdfUrl?: string;
    xmlUrl?: string;
    erroMessage?: string;
  }> {
    const base = this.baseUrl.replace(/\/$/, "");
    const url = `${base}/v2/nfse/${encodeURIComponent(referencia)}`;
    const res = await fetchWithTimeout(
      url,
      { method: "GET", headers: { Authorization: basicAuthHeader(this.token) } },
      TIMEOUT_MS
    );
    const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new NfseError(
        String(payload.mensagem ?? `Focus consulta HTTP ${res.status}`),
        "FOCUS_CLIENT_ERROR",
        res.status,
        res.status < 500
      );
    }
    return {
      status: mapFocusStatus(String(payload.status)),
      numeroNfse: payload.numero ? String(payload.numero) : undefined,
      pdfUrl: payload.url ? String(payload.url) : undefined,
      xmlUrl: payload.caminho_xml_nota_fiscal ? String(payload.caminho_xml_nota_fiscal) : undefined,
      erroMessage: payload.mensagem ? String(payload.mensagem) : undefined
    };
  }

  async cancelar(referencia: string, justificativa = "Cancelamento solicitado"): Promise<void> {
    const base = this.baseUrl.replace(/\/$/, "");
    const url = `${base}/v2/nfse/${encodeURIComponent(referencia)}?justificativa=${encodeURIComponent(justificativa)}`;
    const res = await fetchWithTimeout(
      url,
      { method: "DELETE", headers: { Authorization: basicAuthHeader(this.token) } },
      TIMEOUT_MS
    );
    if (!res.ok && res.status !== 204) {
      const payload = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      throw new NfseError(
        String(payload.mensagem ?? `Focus cancel HTTP ${res.status}`),
        "FOCUS_CLIENT_ERROR",
        res.status,
        res.status < 500
      );
    }
  }
}
