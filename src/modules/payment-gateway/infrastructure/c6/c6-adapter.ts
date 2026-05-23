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
import type { GatewayAdapterContext } from "../../domain/gateway-types";
import { C6HttpClient } from "./c6-http-client";
import type { C6BoletoResponse, C6EmitBoletoPayload } from "./c6-types";

const DEFAULT_ADDRESS: CreateCustomerInput["endereco"] = {
  logradouro: "Nao informado",
  numero: "S/N",
  bairro: "Centro",
  cidade: "Sao Paulo",
  uf: "SP",
  cep: "01001000"
};

const EMIT_PATH = process.env.C6_EMIT_BOLETO_PATH?.trim() || "/v1/cobrancas/boletos";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function parseC6CustomerId(gatewayCustomerId: string): CreateCustomerInput {
  const raw = gatewayCustomerId.replace(/^c6:/, "");
  const [doc, nameEnc, emailEnc] = raw.split("|");
  return {
    name: nameEnc ? decodeURIComponent(nameEnc) : "Cliente",
    cpfCnpj: doc || raw,
    email: emailEnc ? decodeURIComponent(emailEnc) : "cobranca@local.dev",
    externalReference: doc || raw
  };
}

function parseDueDateAsExpiresAt(dueDate: string): Date {
  const d = new Date(`${dueDate}T23:59:59.999Z`);
  if (Number.isNaN(d.getTime())) {
    throw new GatewayProviderError("c6", `dueDate invalido: ${dueDate}`);
  }
  return d;
}

function mapBoletoResult(data: C6BoletoResponse, dueDate: string): BoletoResult {
  const id = data.id?.trim() || data.numeroTitulo?.trim();
  if (!id) {
    throw new GatewayProviderError("c6", "id do boleto ausente na resposta.", { providerBody: data });
  }
  const linha = data.linhaDigitavel?.trim() || data.codigoBarras?.trim() || "";
  const url = data.urlBoleto?.trim() || `c6://boleto/${id}`;
  return {
    gatewayTransactionId: id,
    boletoUrl: url,
    boletoPdfUrl: url,
    barCode: data.codigoBarras?.trim() || linha,
    identificationField: linha,
    nossoNumero: data.nossoNumero?.trim() || "",
    expiresAt: parseDueDateAsExpiresAt(dueDate),
    providerRaw: data as unknown as Record<string, unknown>
  };
}

export class C6BankAdapter implements PaymentGatewayAdapter {
  private readonly http: C6HttpClient;

  constructor(private readonly ctx: GatewayAdapterContext) {
    this.http = new C6HttpClient(ctx);
  }

  async createCustomer(input: CreateCustomerInput): Promise<string> {
    const doc = digitsOnly(input.cpfCnpj) || input.externalReference;
    const name = encodeURIComponent(input.name.trim().slice(0, 80));
    const email = encodeURIComponent(input.email.trim());
    return `c6:${doc}|${name}|${email}`;
  }

  async createBoleto(input: CreateBoletoInput): Promise<BoletoResult> {
    const fromId = parseC6CustomerId(input.gatewayCustomerId);
    const cliente: CreateCustomerInput = input.payer
      ? {
          ...fromId,
          ...input.payer,
          endereco: input.payer.endereco ?? fromId.endereco
        }
      : fromId;
    const doc = digitsOnly(cliente.cpfCnpj);
    const addr: NonNullable<CreateCustomerInput["endereco"]> = cliente.endereco ?? DEFAULT_ADDRESS!;

    const payload: C6EmitBoletoPayload = {
      conta: this.ctx.credentials.conta?.trim() ?? "",
      agencia: this.ctx.credentials.agencia?.trim() ?? "",
      codigoCedente: this.ctx.credentials.codigo_cedente?.trim() ?? "",
      modalidade: this.ctx.credentials.modalidade?.trim() ?? "1",
      numeroTitulo: input.externalReference.replace(/[^a-zA-Z0-9]/g, "").slice(0, 15) || "COB001",
      dataVencimento: input.dueDate,
      valor: input.value,
      pagador: {
        nome: cliente.name.trim().slice(0, 100),
        cpfCnpj: doc,
        tipoPessoa: doc.length > 11 ? "JURIDICA" : "FISICA",
        endereco: `${addr.logradouro}${addr.numero ? `, ${addr.numero}` : ""}`.slice(0, 100),
        bairro: addr.bairro.slice(0, 60),
        cidade: addr.cidade.slice(0, 60),
        uf: addr.uf.slice(0, 2).toUpperCase(),
        cep: digitsOnly(addr.cep).slice(0, 8)
      }
    };

    const data = await this.http.requestJson<C6BoletoResponse>("POST", EMIT_PATH, payload);
    return mapBoletoResult(data, input.dueDate);
  }

  async createPix(_input: CreatePixInput): Promise<PixResult> {
    throw new GatewayProviderError("c6", "PIX nao suportado no adapter C6 nesta versao.", {
      code: "not_supported"
    });
  }

  async cancelCharge(gatewayTransactionId: string): Promise<void> {
    const id = gatewayTransactionId.trim();
    await this.http.requestJson("POST", `/v1/cobrancas/boletos/${encodeURIComponent(id)}/cancelar`, {});
  }

  async getCharge(gatewayTransactionId: string): Promise<GatewayChargeSnapshot> {
    const id = gatewayTransactionId.trim();
    const data = await this.http.requestJson<C6BoletoResponse>(
      "GET",
      `/v1/cobrancas/boletos/${encodeURIComponent(id)}`
    );
    return { status: data.situacao?.trim() || "UNKNOWN" };
  }
}
