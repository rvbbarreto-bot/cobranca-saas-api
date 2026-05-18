import { PaymentGatewayError } from "../../domain/payment-gateway-error";

export type AsaasHttpClientConfig = {
  apiKey: string;
  baseUrl?: string;
};

const DEFAULT_BASE_URL = "https://sandbox.asaas.com/api/v3";

export class AsaasHttpClient {
  constructor(private readonly config: AsaasHttpClientConfig) {}

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const base = (this.config.baseUrl?.trim() || DEFAULT_BASE_URL).replace(/\/$/, "");
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          access_token: this.config.apiKey
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (error: unknown) {
      throw new PaymentGatewayError("Falha de rede ao chamar Asaas.", {
        code: "asaas_network_error",
        cause: error
      });
    }

    const text = await response.text();
    let parsed: unknown = null;
    if (text) {
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        parsed = text;
      }
    }

    if (!response.ok) {
      const msg =
        typeof parsed === "object" &&
        parsed !== null &&
        "errors" in parsed &&
        Array.isArray((parsed as { errors: unknown }).errors)
          ? JSON.stringify((parsed as { errors: unknown[] }).errors)
          : text || response.statusText;
      throw new PaymentGatewayError(`Asaas HTTP ${response.status}: ${msg}`, {
        code: "asaas_api_error",
        httpStatus: response.status,
        providerBody: parsed
      });
    }

    return parsed as T;
  }
}
