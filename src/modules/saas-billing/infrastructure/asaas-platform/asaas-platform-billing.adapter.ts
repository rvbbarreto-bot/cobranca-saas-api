import { AsaasHttpClient } from "../../../payment-gateway/infrastructure/asaas/asaas-http-client";
import { PaymentGatewayError } from "../../../payment-gateway/domain/payment-gateway-error";
import type { PlatformAsaasConfig } from "./platform-asaas-config";

type AsaasCustomerResponse = { id: string };
type AsaasSubscriptionResponse = {
  id: string;
  status?: string;
  customer?: string;
};

export type CreatePlatformSubscriptionInput = {
  customerId: string;
  value: number;
  nextDueDate: string;
  description: string;
  externalReference: string;
  billingType: PlatformAsaasConfig["billingType"];
};

export class AsaasPlatformBillingAdapter {
  private readonly http: AsaasHttpClient;

  constructor(config: PlatformAsaasConfig) {
    this.http = new AsaasHttpClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl
    });
    this.defaultBillingType = config.billingType;
  }

  private readonly defaultBillingType: PlatformAsaasConfig["billingType"];

  async createCustomer(input: {
    name: string;
    email: string;
    cpfCnpj: string;
    externalReference: string;
  }): Promise<string> {
    const res = await this.http.request<AsaasCustomerResponse>("POST", "/customers", {
      name: input.name.trim(),
      email: input.email.trim(),
      cpfCnpj: input.cpfCnpj.replace(/\D/g, ""),
      externalReference: input.externalReference.trim()
    });
    if (!res.id?.trim()) {
      throw new PaymentGatewayError("Asaas nao retornou id do cliente (platform).", {
        code: "asaas_invalid_response"
      });
    }
    return res.id;
  }

  async createSubscription(input: CreatePlatformSubscriptionInput): Promise<string> {
    const res = await this.http.request<AsaasSubscriptionResponse>("POST", "/subscriptions", {
      customer: input.customerId,
      billingType: input.billingType ?? this.defaultBillingType,
      value: input.value,
      nextDueDate: input.nextDueDate,
      cycle: "MONTHLY",
      description: input.description,
      externalReference: input.externalReference
    });
    if (!res.id?.trim()) {
      throw new PaymentGatewayError("Asaas nao retornou id da assinatura.", {
        code: "asaas_invalid_response"
      });
    }
    return res.id;
  }

  async cancelSubscription(gatewaySubscriptionId: string): Promise<void> {
    await this.http.request("DELETE", `/subscriptions/${encodeURIComponent(gatewaySubscriptionId)}`);
  }
}
