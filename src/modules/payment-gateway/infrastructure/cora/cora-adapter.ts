import { randomUUID } from "node:crypto";
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
import type { GatewayAdapterContext } from "../../domain/gateway-types";
import { CoraHttpClient } from "./cora-http-client";
import type { CoraInvoicePayload, CoraInvoiceResponse } from "./cora-types";

const DEFAULT_ADDRESS: CreateCustomerInput["endereco"] = {
  logradouro: "Nao informado",
  numero: "S/N",
  bairro: "Centro",
  cidade: "Sao Paulo",
  uf: "SP",
  cep: "01001000"
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

function parseDueDateAsExpiresAt(dueDate: string): Date {
  const d = new Date(`${dueDate}T23:59:59.999Z`);
  if (Number.isNaN(d.getTime())) {
    throw new GatewayProviderError("cora", `dueDate invalido: ${dueDate}`);
  }
  return d;
}

function parseCoraGatewayCustomerId(gatewayCustomerId: string): CreateCustomerInput {
  const raw = gatewayCustomerId.replace(/^cora:/, "");
  const [doc, nameEnc, emailEnc] = raw.split("|");
  return {
    name: nameEnc ? decodeURIComponent(nameEnc) : "Cliente",
    cpfCnpj: doc || raw,
    email: emailEnc ? decodeURIComponent(emailEnc) : "cobranca@local.dev",
    externalReference: doc || raw
  };
}

function toCents(value: number): number {
  return Math.round(value * 100);
}

function buildInvoicePayload(
  cliente: CreateCustomerInput,
  input: CreateBoletoInput | CreatePixInput,
  paymentForms: Array<"BANK_SLIP" | "PIX">
): CoraInvoicePayload {
  const doc = digitsOnly(cliente.cpfCnpj);
  const addr: NonNullable<CreateCustomerInput["endereco"]> = cliente.endereco ?? DEFAULT_ADDRESS!;
  return {
    code: input.externalReference.slice(0, 64),
    customer: {
      name: cliente.name.trim().slice(0, 120),
      email: cliente.email.trim(),
      document: {
        identity: doc,
        type: doc.length > 11 ? "CNPJ" : "CPF"
      },
      address: {
        street: addr.logradouro.slice(0, 120),
        number: (addr.numero ?? "S/N").slice(0, 20),
        district: addr.bairro.slice(0, 60),
        city: addr.cidade.slice(0, 60),
        state: addr.uf.slice(0, 2).toUpperCase(),
        complement: addr.complemento?.slice(0, 60),
        zip_code: digitsOnly(addr.cep).slice(0, 8)
      }
    },
    services: [
      {
        name: input.description.slice(0, 80) || "Cobranca",
        description: input.description.slice(0, 200),
        amount: toCents(input.value)
      }
    ],
    payment_terms: { due_date: input.dueDate },
    payment_forms: paymentForms
  };
}

function mapBoletoResult(data: CoraInvoiceResponse, dueDate: string): BoletoResult {
  const id = data.id?.trim();
  if (!id) {
    throw new GatewayProviderError("cora", "id ausente na resposta.", { providerBody: data });
  }
  const slip = data.bank_slip;
  const url = slip?.url?.trim() || `cora://invoice/${id}`;
  const linha = slip?.type_full_code?.trim() || slip?.barcode?.trim() || "";
  return {
    gatewayTransactionId: id,
    boletoUrl: url,
    boletoPdfUrl: url,
    barCode: slip?.barcode?.trim() || linha,
    identificationField: linha,
    nossoNumero: slip?.our_number?.trim() || "",
    expiresAt: parseDueDateAsExpiresAt(dueDate),
    providerRaw: data as unknown as Record<string, unknown>
  };
}

function mapPixResult(data: CoraInvoiceResponse, dueDate: string): PixResult {
  const id = data.id?.trim();
  if (!id) {
    throw new GatewayProviderError("cora", "id ausente na resposta.", { providerBody: data });
  }
  const pix = data.pix;
  const emv = pix?.qr_code?.trim() || "";
  const link = pix?.qr_code_url?.trim() || "";
  if (!emv) {
    throw new GatewayProviderError("cora", "PIX nao retornado pela Cora.", { providerBody: data });
  }
  return {
    gatewayTransactionId: id,
    pixQrcodeBase64: "",
    pixEmv: emv,
    pixLink: link,
    expiresAt: parseDueDateAsExpiresAt(dueDate),
    providerRaw: data as unknown as Record<string, unknown>
  };
}

export class CoraAdapter implements PaymentGatewayAdapter {
  private readonly http: CoraHttpClient;

  constructor(private readonly ctx: GatewayAdapterContext) {
    const agent = buildMtlsAgent({
      certPem: ctx.credentials.certificate_pem ?? "",
      keyPem: ctx.credentials.private_key_pem ?? ""
    });
    this.http = new CoraHttpClient(ctx, agent);
  }

  async createCustomer(input: CreateCustomerInput): Promise<string> {
    const doc = digitsOnly(input.cpfCnpj) || input.externalReference;
    const name = encodeURIComponent(input.name.trim().slice(0, 80));
    const email = encodeURIComponent(input.email.trim());
    return `cora:${doc}|${name}|${email}`;
  }

  async createBoleto(input: CreateBoletoInput): Promise<BoletoResult> {
    const cliente = parseCoraGatewayCustomerId(input.gatewayCustomerId);
    const payload = buildInvoicePayload(cliente, input, ["BANK_SLIP"]);
    const data = await this.http.requestJson<CoraInvoiceResponse>(
      "POST",
      "/v2/invoices",
      payload,
      randomUUID()
    );
    return mapBoletoResult(data, input.dueDate);
  }

  async createPix(input: CreatePixInput): Promise<PixResult> {
    const cliente = parseCoraGatewayCustomerId(input.gatewayCustomerId);
    const payload = buildInvoicePayload(cliente, input, ["PIX"]);
    const data = await this.http.requestJson<CoraInvoiceResponse>(
      "POST",
      "/v2/invoices",
      payload,
      randomUUID()
    );
    return mapPixResult(data, input.dueDate);
  }

  async cancelCharge(gatewayTransactionId: string): Promise<void> {
    const id = gatewayTransactionId.trim();
    await this.http.requestJson("DELETE", `/v2/invoices/${encodeURIComponent(id)}`);
  }

  async getCharge(gatewayTransactionId: string): Promise<GatewayChargeSnapshot> {
    const id = gatewayTransactionId.trim();
    const data = await this.http.requestJson<CoraInvoiceResponse>(
      "GET",
      `/v2/invoices/${encodeURIComponent(id)}`
    );
    return { status: data.status?.trim() || "UNKNOWN" };
  }
}
