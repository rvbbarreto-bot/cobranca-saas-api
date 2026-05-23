import { buildMtlsAgent } from "../../../../platform/payment-gateway/mtls-agent";
import type {
  BoletoResult,
  CreateBoletoInput,
  CreateCustomerInput,
  CreatePixInput,
  GatewayChargeSnapshot,
  PaymentGatewayAdapter,
  PixResult
} from "../../domain/payment-gateway.interface";
import { GatewayProviderError } from "../../domain/payment-gateway-error";
import { requirePayerAddress } from "../../domain/require-payer-address";
import type { GatewayAdapterContext } from "../../domain/gateway-types";
import { InterHttpClient } from "./inter-http-client";
import { buildInterPdfPlaceholder } from "./inter-pdf-url";
import type { InterBoletoResponse, InterEmitBoletoPayload } from "./inter-types";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function parseDueDateAsExpiresAt(dueDate: string): Date {
  const d = new Date(`${dueDate}T23:59:59.999Z`);
  if (Number.isNaN(d.getTime())) {
    throw new GatewayProviderError("inter", `dueDate invalido: ${dueDate}`);
  }
  return d;
}

function seuNumeroFromExternalReference(ref: string): string {
  const compact = ref.replace(/[^a-zA-Z0-9]/g, "").slice(0, 15);
  return compact || "COB001";
}

function parseInterGatewayCustomerId(gatewayCustomerId: string): CreateCustomerInput {
  const raw = gatewayCustomerId.replace(/^inter:/, "");
  const [doc, nameEnc, emailEnc] = raw.split("|");
  return {
    name: nameEnc ? decodeURIComponent(nameEnc) : "Cliente",
    cpfCnpj: doc || raw,
    email: emailEnc ? decodeURIComponent(emailEnc) : "cobranca@local.dev",
    externalReference: doc || raw
  };
}

function buildPagador(input: CreateCustomerInput): InterEmitBoletoPayload["pagador"] {
  const doc = digitsOnly(input.cpfCnpj);
  const addr = requirePayerAddress("inter", input.endereco);
  const phone = digitsOnly(input.phone ?? "");
  const ddd = phone.length >= 10 ? phone.slice(0, 2) : "11";
  const telefone = phone.length >= 10 ? phone.slice(2) : phone || "999999999";

  return {
    cpfCnpj: doc,
    tipoPessoa: doc.length > 11 ? "JURIDICA" : "FISICA",
    nome: input.name.trim().slice(0, 100),
    endereco: `${addr.logradouro}${addr.numero ? `, ${addr.numero}` : ""}`.slice(0, 100),
    bairro: addr.bairro.slice(0, 60),
    cidade: addr.cidade.slice(0, 60),
    uf: addr.uf.slice(0, 2).toUpperCase(),
    cep: digitsOnly(addr.cep).slice(0, 8),
    email: input.email?.trim() || undefined,
    ddd,
    telefone
  };
}

function mapBoletoResult(data: InterBoletoResponse, dueDate: string): BoletoResult {
  const codigo = data.codigoSolicitacao?.trim();
  if (!codigo) {
    throw new GatewayProviderError("inter", "codigoSolicitacao ausente na resposta.", {
      providerBody: data
    });
  }
  const linha = data.linhaDigitavel?.trim() || data.codigoBarras?.trim() || "";
  const pdfUrl = buildInterPdfPlaceholder(codigo);
  return {
    gatewayTransactionId: codigo,
    boletoUrl: pdfUrl,
    boletoPdfUrl: pdfUrl,
    barCode: data.codigoBarras?.trim() || linha,
    identificationField: linha,
    nossoNumero: data.nossoNumero?.trim() || "",
    expiresAt: parseDueDateAsExpiresAt(dueDate),
    providerRaw: data as unknown as Record<string, unknown>
  };
}

export class InterAdapter implements PaymentGatewayAdapter {
  private readonly http: InterHttpClient;

  constructor(private readonly ctx: GatewayAdapterContext) {
    const agent = buildMtlsAgent({
      certPem: ctx.credentials.certificate_pem ?? "",
      keyPem: ctx.credentials.private_key_pem ?? ""
    });
    this.http = new InterHttpClient(ctx, agent);
  }

  async createCustomer(input: CreateCustomerInput): Promise<string> {
    const doc = digitsOnly(input.cpfCnpj) || input.externalReference;
    const name = encodeURIComponent(input.name.trim().slice(0, 80));
    const email = encodeURIComponent(input.email.trim());
    return `inter:${doc}|${name}|${email}`;
  }

  async createBoleto(input: CreateBoletoInput): Promise<BoletoResult> {
    const fromId = parseInterGatewayCustomerId(input.gatewayCustomerId);
    const cliente: CreateCustomerInput = input.payer
      ? {
          ...fromId,
          ...input.payer,
          endereco: input.payer.endereco ?? fromId.endereco
        }
      : fromId;
    const payload: InterEmitBoletoPayload = {
      seuNumero: seuNumeroFromExternalReference(input.externalReference),
      valorNominal: input.value,
      dataVencimento: input.dueDate,
      numDiasAgenda: 60,
      pagador: buildPagador(cliente),
      mensagem: { linha1: input.description.slice(0, 78) }
    };

    let data = await this.http.requestJson<InterBoletoResponse>("POST", "/cobrancas/v2", payload);

    for (let attempt = 0; attempt < 3 && data.situacao === "EM_PROCESSAMENTO"; attempt += 1) {
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      if (data.codigoSolicitacao) {
        data = await this.http.requestJson<InterBoletoResponse>(
          "GET",
          `/cobrancas/v2/${encodeURIComponent(data.codigoSolicitacao)}`
        );
      }
    }

    return mapBoletoResult(data, input.dueDate);
  }

  async createPix(_input: CreatePixInput): Promise<PixResult> {
    throw new GatewayProviderError("inter", "PIX dedicado nao suportado no Inter (use boleto).", {
      code: "not_supported"
    });
  }

  async cancelCharge(gatewayTransactionId: string): Promise<void> {
    const id = gatewayTransactionId.trim();
    await this.http.requestJson("POST", `/cobrancas/v2/${encodeURIComponent(id)}/cancelar`, {
      motivoCancelamento: "ACERTOS"
    });
  }

  async getCharge(gatewayTransactionId: string): Promise<GatewayChargeSnapshot> {
    const id = gatewayTransactionId.trim();
    const data = await this.http.requestJson<InterBoletoResponse>(
      "GET",
      `/cobrancas/v2/${encodeURIComponent(id)}`
    );
    return {
      status: data.situacao?.trim() || "UNKNOWN"
    };
  }

  async downloadBoletoPdf(gatewayTransactionId: string): Promise<Buffer> {
    const id = gatewayTransactionId.trim();
    return this.http.requestPdf(`/cobrancas/v2/${encodeURIComponent(id)}/pdf`);
  }
}
