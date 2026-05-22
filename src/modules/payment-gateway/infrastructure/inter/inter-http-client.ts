import type https from "node:https";
import { GatewayProviderError } from "../../domain/payment-gateway-error";
import type { GatewayAdapterContext } from "../../domain/gateway-types";
import { mtlsFetch } from "../../../../platform/payment-gateway/mtls-fetch";
import { getInterAccessToken, interBaseUrl } from "./inter-oauth";

export class InterHttpClient {
  constructor(
    private readonly ctx: GatewayAdapterContext,
    private readonly agent: https.Agent
  ) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await getInterAccessToken(this.ctx, this.agent);
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
  }

  async requestJson<T>(method: string, path: string, body?: unknown): Promise<T> {
    const base = interBaseUrl(this.ctx.sandbox);
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = await this.authHeaders();
    const res = await mtlsFetch(url, {
      method,
      agent: this.agent,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });

    let parsed: unknown = null;
    if (res.text) {
      try {
        parsed = JSON.parse(res.text) as unknown;
      } catch {
        parsed = res.text;
      }
    }

    if (res.status < 200 || res.status >= 300) {
      throw new GatewayProviderError("inter", `Inter HTTP ${res.status}`, {
        httpStatus: res.status,
        providerBody: parsed
      });
    }

    return parsed as T;
  }
}
