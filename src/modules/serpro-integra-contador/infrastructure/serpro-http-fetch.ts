import https from "node:https";
import { URL } from "node:url";

function connectTimeoutMs(): number {
  const raw = process.env.SERPRO_CONNECT_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : 60_000;
  return Number.isFinite(n) && n > 0 ? n : 60_000;
}

export type SerproHttpResponse = {
  ok: boolean;
  status: number;
  headers: Record<string, string | string[] | undefined>;
  text: () => Promise<string>;
};

/** HTTPS com timeout alto — gateway SERPRO pode levar >10s só para abrir TCP. */
export function serproHttpsRequest(
  url: string,
  init: { method?: string; headers?: Record<string, string>; body?: string },
  tls?: { certPem: string; keyPem: string }
): Promise<SerproHttpResponse> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const timeoutMs = connectTimeoutMs();
    const req = https.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: init.method ?? "GET",
        headers: init.headers,
        cert: tls?.certPem,
        key: tls?.keyPem,
        /** IPv6 do gateway SERPRO costuma falhar/timeout em redes residenciais — forçar IPv4. */
        family: 4
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          const bodyStr = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: res.headers,
            text: async () => bodyStr
          });
        });
      }
    );

    req.setTimeout(timeoutMs, () => {
      req.destroy(
        Object.assign(new Error(`SERPRO HTTPS timeout após ${timeoutMs}ms`), {
          code: "UND_ERR_CONNECT_TIMEOUT"
        })
      );
    });
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}
