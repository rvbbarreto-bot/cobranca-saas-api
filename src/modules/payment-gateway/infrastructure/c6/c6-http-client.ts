import { GatewayProviderError } from "../../domain/payment-gateway-error";
import type { GatewayAdapterContext } from "../../domain/gateway-types";
import { c6ApiBaseUrl, getC6AccessToken } from "./c6-oauth";

export class C6HttpClient {
  constructor(private readonly ctx: GatewayAdapterContext) {}

  async requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
    const token = await getC6AccessToken(this.ctx);
    const base = c6ApiBaseUrl(this.ctx.sandbox);
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: body !== undefined ? JSON.stringify(body) : undefined
      });
    } catch (error: unknown) {
      throw new GatewayProviderError("c6", "Falha de rede C6.", { cause: error });
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
      throw new GatewayProviderError("c6", `C6 HTTP ${response.status}`, {
        httpStatus: response.status,
        providerBody: parsed
      });
    }

    return parsed as T;
  }
}
