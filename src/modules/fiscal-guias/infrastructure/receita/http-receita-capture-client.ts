import { buildMtlsAgent } from "../../../../platform/payment-gateway/mtls-agent";
import { mtlsFetch } from "../../../../platform/payment-gateway/mtls-fetch";
import { ReceitaGatewayError } from "../../domain/receita-gateway-error";

export function isReceitaTlsInsecure(): boolean {
  return process.env.RECEITA_DAS_TLS_INSECURE?.trim().toLowerCase() === "true";
}

export async function postReceitaCaptureJson(input: {
  baseUrl: string;
  path: string;
  body: Record<string, unknown>;
  certPem: string;
  keyPem: string;
  gatewayLabel: "DAS" | "DARF";
}): Promise<unknown> {
  const base = input.baseUrl.replace(/\/$/, "");
  const url = `${base}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;
  const body = JSON.stringify(input.body);
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json"
  };

  let res: Awaited<ReturnType<typeof mtlsFetch>> | { status: number; text: string };
  try {
    if (base.startsWith("http://")) {
      const response = await fetch(url, { method: "POST", headers, body });
      res = { status: response.status, text: await response.text() };
    } else {
      const agent = buildMtlsAgent({
        certPem: input.certPem,
        keyPem: input.keyPem,
        rejectUnauthorized: !isReceitaTlsInsecure()
      });
      res = await mtlsFetch(url, { method: "POST", agent, headers, body });
    }
  } catch (error: unknown) {
    throw new ReceitaGatewayError(`Falha de rede ao capturar ${input.gatewayLabel} na Receita.`, {
      code: "receita_network_error",
      cause: error
    });
  }

  let parsed: unknown = null;
  if (res.text) {
    try {
      parsed = JSON.parse(res.text) as unknown;
    } catch {
      parsed = res.text;
    }
  }

  if (res.status < 200 || res.status >= 300) {
    throw new ReceitaGatewayError(`Receita ${input.gatewayLabel} HTTP ${res.status}`, {
      code: "receita_http_error",
      httpStatus: res.status,
      providerBody: parsed
    });
  }

  return parsed;
}
