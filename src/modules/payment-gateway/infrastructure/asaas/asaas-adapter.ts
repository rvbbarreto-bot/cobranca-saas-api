import type {
  BoletoResult,
  CreateBoletoInput,
  CreateCustomerInput,
  CreatePixInput,
  GatewayChargeSnapshot,
  PaymentGatewayAdapter,
  PixResult
} from "../../domain/payment-gateway.interface";
import { PaymentGatewayError } from "../../domain/payment-gateway-error";
import { AsaasHttpClient, type AsaasHttpClientConfig } from "./asaas-http-client";
import type { AsaasCustomerResponse, AsaasPaymentResponse, AsaasPixQrCodeResponse } from "./asaas-types";

const DEFAULT_ASAAS_SANDBOX_URL = "https://sandbox.asaas.com/api/v3";
const DEFAULT_FINE_PERCENT = 2;
const DEFAULT_INTEREST_PERCENT = 0.033;

function parseDueDateAsExpiresAt(dueDate: string): Date {
  const d = new Date(`${dueDate}T23:59:59.999Z`);
  if (Number.isNaN(d.getTime())) {
    throw new PaymentGatewayError(`dueDate invalido: ${dueDate}`, { code: "invalid_due_date" });
  }
  return d;
}

function parseOptionalDate(value: string | null | undefined): Date | undefined {
  if (!value?.trim()) {
    return undefined;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export type AsaasAdapterConfig = AsaasHttpClientConfig;

export class AsaasAdapter implements PaymentGatewayAdapter {
  private readonly http: AsaasHttpClient;

  constructor(config: AsaasAdapterConfig) {
    if (!config.apiKey?.trim()) {
      throw new PaymentGatewayError("ASAAS_API_KEY ausente.", { code: "asaas_config_missing" });
    }
    this.http = new AsaasHttpClient({
      apiKey: config.apiKey.trim(),
      baseUrl: (config.baseUrl?.trim() || DEFAULT_ASAAS_SANDBOX_URL).replace(/\/$/, "")
    });
  }

  async createCustomer(input: CreateCustomerInput): Promise<string> {
    const cpfCnpj = digitsOnly(input.cpfCnpj);
    if (!cpfCnpj) {
      throw new PaymentGatewayError("cpfCnpj obrigatorio.", { code: "invalid_document" });
    }

    const body: Record<string, unknown> = {
      name: input.name.trim(),
      cpfCnpj,
      email: input.email.trim(),
      externalReference: input.externalReference.trim()
    };
    const phone = input.phone?.trim();
    if (phone) {
      body.mobilePhone = digitsOnly(phone);
    }

    const res = await this.http.request<AsaasCustomerResponse>("POST", "/customers", body);
    if (!res.id?.trim()) {
      throw new PaymentGatewayError("Asaas nao retornou id do cliente.", {
        code: "asaas_invalid_response",
        providerBody: res
      });
    }
    return res.id;
  }

  async createBoleto(input: CreateBoletoInput): Promise<BoletoResult> {
    const payment = await this.createPayment(input, "BOLETO", {
      fine: { value: input.finePercent ?? DEFAULT_FINE_PERCENT },
      interest: { value: input.interestPercent ?? DEFAULT_INTEREST_PERCENT }
    });

    const identification =
      payment.identificationField?.trim() ||
      (await this.fetchIdentificationField(payment.id));

    const boletoUrl = payment.bankSlipUrl?.trim() || payment.invoiceUrl?.trim() || "";
    const boletoPdfUrl = payment.invoiceUrl?.trim() || payment.bankSlipUrl?.trim() || boletoUrl;

    if (!boletoUrl) {
      throw new PaymentGatewayError("Asaas nao retornou URL do boleto.", {
        code: "asaas_invalid_response",
        providerBody: payment
      });
    }

    return {
      gatewayTransactionId: payment.id,
      boletoUrl,
      boletoPdfUrl,
      barCode: payment.barCode?.trim() || identification,
      identificationField: identification,
      nossoNumero: payment.nossoNumero?.trim() || "",
      expiresAt: parseDueDateAsExpiresAt(input.dueDate),
      providerRaw: payment as unknown as Record<string, unknown>
    };
  }

  async createPix(input: CreatePixInput): Promise<PixResult> {
    const payment = await this.createPayment(input, "PIX");
    const qr = await this.http.request<AsaasPixQrCodeResponse>(
      "GET",
      `/payments/${encodeURIComponent(payment.id)}/pixQrCode`
    );

    const pixEmv = qr.payload?.trim() || "";
    const pixQrcodeBase64 = qr.encodedImage?.trim() || "";
    if (!pixEmv || !pixQrcodeBase64) {
      throw new PaymentGatewayError("Asaas nao retornou dados do PIX.", {
        code: "asaas_invalid_response",
        providerBody: { payment, qr }
      });
    }

    const expiresAt =
      parseOptionalDate(qr.expirationDate) ?? parseDueDateAsExpiresAt(input.dueDate);

    return {
      gatewayTransactionId: payment.id,
      pixQrcodeBase64,
      pixEmv,
      pixLink: payment.invoiceUrl?.trim() || payment.bankSlipUrl?.trim() || "",
      expiresAt,
      providerRaw: { payment, pixQrCode: qr } as unknown as Record<string, unknown>
    };
  }

  async cancelCharge(gatewayTransactionId: string): Promise<void> {
    const id = gatewayTransactionId.trim();
    if (!id) {
      throw new PaymentGatewayError("gatewayTransactionId ausente.", { code: "invalid_transaction_id" });
    }
    await this.http.request<unknown>("DELETE", `/payments/${encodeURIComponent(id)}`);
  }

  async getCharge(gatewayTransactionId: string): Promise<GatewayChargeSnapshot> {
    const id = gatewayTransactionId.trim();
    if (!id) {
      throw new PaymentGatewayError("gatewayTransactionId ausente.", { code: "invalid_transaction_id" });
    }
    const payment = await this.http.request<AsaasPaymentResponse>(
      "GET",
      `/payments/${encodeURIComponent(id)}`
    );
    const paidAt =
      parseOptionalDate(payment.paymentDate) ||
      parseOptionalDate(payment.confirmedDate) ||
      parseOptionalDate(payment.clientPaymentDate);

    return {
      status: payment.status?.trim() || "UNKNOWN",
      paidAt
    };
  }

  private async createPayment(
    input: CreateBoletoInput | CreatePixInput,
    billingType: "BOLETO" | "PIX",
    extras?: Record<string, unknown>
  ): Promise<AsaasPaymentResponse> {
    const body: Record<string, unknown> = {
      customer: input.gatewayCustomerId.trim(),
      billingType,
      value: input.value,
      dueDate: input.dueDate,
      description: input.description.trim(),
      externalReference: input.externalReference.trim(),
      ...extras
    };

    const payment = await this.http.request<AsaasPaymentResponse>("POST", "/payments", body);
    if (!payment.id?.trim()) {
      throw new PaymentGatewayError("Asaas nao retornou id da cobranca.", {
        code: "asaas_invalid_response",
        providerBody: payment
      });
    }
    return payment;
  }

  private async fetchIdentificationField(paymentId: string): Promise<string> {
    const row = await this.http.request<{ identificationField?: string | null }>(
      "GET",
      `/payments/${encodeURIComponent(paymentId)}/identificationField`
    );
    const field = row.identificationField?.trim() || "";
    if (!field) {
      throw new PaymentGatewayError("Asaas nao retornou linha digitavel do boleto.", {
        code: "asaas_invalid_response",
        providerBody: row
      });
    }
    return field;
  }
}

export function createAsaasAdapterFromEnv(): AsaasAdapter {
  return new AsaasAdapter({
    apiKey: process.env.ASAAS_API_KEY?.trim() ?? "",
    baseUrl: process.env.ASAAS_API_URL?.trim() || DEFAULT_ASAAS_SANDBOX_URL
  });
}
