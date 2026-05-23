import type https from "node:https";
import { GatewayProviderError } from "../../domain/payment-gateway-error";
import type { GatewayAdapterContext } from "../../domain/gateway-types";
import { mtlsFetch, mtlsFetchBuffer } from "../../../../platform/payment-gateway/mtls-fetch";
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

  async requestPdf(path: string): Promise<Buffer> {
    const base = interBaseUrl(this.ctx.sandbox);
    const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
    const headers = await this.authHeaders();
    const res = await mtlsFetchBuffer(url, {
      method: "GET",
      agent: this.agent,
      headers: {
        ...headers,
        Accept: "application/pdf"
      }
    });

    if (res.status < 200 || res.status >= 300) {
      let providerBody: unknown = null;
      try {
        providerBody = JSON.parse(res.body.toString("utf8")) as unknown;
      } catch {
        providerBody = res.body.toString("utf8").slice(0, 500);
      }
      throw new GatewayProviderError("inter", `Inter PDF HTTP ${res.status}`, {
        httpStatus: res.status,
        providerBody
      });
    }

    const contentType = res.headers["content-type"] ?? "";
    if (!contentType.includes("pdf") && res.body.length < 4) {
      throw new GatewayProviderError("inter", "Resposta PDF vazia ou invalida.", {
        httpStatus: res.status,
        providerBody: { contentType, length: res.body.length }
      });
    }

    return res.body;
  }
}
