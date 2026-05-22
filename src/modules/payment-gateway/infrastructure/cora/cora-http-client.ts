import type https from "node:https";
import { GatewayProviderError } from "../../domain/payment-gateway-error";
import type { GatewayAdapterContext } from "../../domain/gateway-types";
import { mtlsFetch } from "../../../../platform/payment-gateway/mtls-fetch";
import { coraBaseUrl, getCoraAccessToken } from "./cora-oauth";

export class CoraHttpClient {
  constructor(
    private readonly ctx: GatewayAdapterContext,
    private readonly agent: https.Agent
  ) {}

  private async authHeaders(idempotencyKey?: string): Promise<Record<string, string>> {
    const token = await getCoraAccessToken(this.ctx, this.agent);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    if (idempotencyKey) {
      headers["Idempotency-Key"] = idempotencyKey;
    }
    return headers;
  }

  async requestJson<T>(method: string, path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
    const base = coraBaseUrl(this.ctx.sandbox);
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = await this.authHeaders(idempotencyKey);
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
      throw new GatewayProviderError("cora", `Cora HTTP ${res.status}`, {
        httpStatus: res.status,
        providerBody: parsed
      });
    }

    return parsed as T;
  }
}
