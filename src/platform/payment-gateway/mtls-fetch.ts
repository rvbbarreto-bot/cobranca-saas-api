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

export function mtlsFetch(url: string, options: MtlsFetchOptions): Promise<MtlsFetchResponse> {
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
          const text = Buffer.concat(chunks).toString("utf8");
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") headers[k.toLowerCase()] = v;
            else if (Array.isArray(v)) headers[k.toLowerCase()] = v.join(", ");
          }
          resolve({ status: res.statusCode ?? 0, headers, text });
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
