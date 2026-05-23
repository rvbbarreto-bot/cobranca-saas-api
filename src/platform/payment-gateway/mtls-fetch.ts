import https from "node:https";
import { URL } from "node:url";

export type MtlsFetchOptions = {
  method: string;
  headers?: Record<string, string>;
  body?: string;
  agent: https.Agent;
};

export type MtlsFetchResponse = {
  status: number;
  headers: Record<string, string>;
  text: string;
};

export type MtlsFetchBufferResponse = {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
};

function readResponseHeaders(res: import("node:http").IncomingMessage): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(res.headers)) {
    if (typeof v === "string") {
      headers[k.toLowerCase()] = v;
    } else if (Array.isArray(v)) {
      headers[k.toLowerCase()] = v.join(", ");
    }
  }
  return headers;
}

function mtlsRequest(
  url: string,
  options: MtlsFetchOptions
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method,
        headers: options.headers,
        agent: options.agent
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 0,
            headers: readResponseHeaders(res),
            body: Buffer.concat(chunks)
          });
        });
      }
    );
    req.on("error", reject);
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

export function mtlsFetch(url: string, options: MtlsFetchOptions): Promise<MtlsFetchResponse> {
  return mtlsRequest(url, options).then((r) => ({
    status: r.status,
    headers: r.headers,
    text: r.body.toString("utf8")
  }));
}

/** Resposta binária (ex.: PDF do Inter). */
export function mtlsFetchBuffer(url: string, options: MtlsFetchOptions): Promise<MtlsFetchBufferResponse> {
  return mtlsRequest(url, options);
}
