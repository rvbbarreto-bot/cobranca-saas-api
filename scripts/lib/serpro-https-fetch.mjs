import https from "node:https";
import { URL } from "node:url";

function connectTimeoutMs() {
  const raw = process.env.SERPRO_CONNECT_TIMEOUT_MS?.trim();
  const n = raw ? Number(raw) : 60_000;
  return Number.isFinite(n) && n > 0 ? n : 60_000;
}

/** @param {string} url @param {{ method?: string; headers?: Record<string,string>; body?: string }} init */
export function serproHttpsRequest(url, init = {}) {
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
        family: 4
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const bodyStr = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
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
