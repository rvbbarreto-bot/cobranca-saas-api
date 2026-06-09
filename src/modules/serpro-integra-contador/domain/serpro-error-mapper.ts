import type { SerproIntegraResponse } from "./serpro-types";
import { SerproIntegraError } from "./serpro-types";

export function mapSerproHttpError(statusCode: number, body: unknown): SerproIntegraError {
  const preview =
    typeof body === "object" && body !== null && "message" in body
      ? String((body as { message: unknown }).message)
      : JSON.stringify(body).slice(0, 300);
  return new SerproIntegraError(
    `SERPRO HTTP ${statusCode}: ${preview}`,
    statusCode >= 500 ? "SERPRO_INDISPONIVEL" : "SERPRO_REJEITOU",
    statusCode,
    body
  );
}

export function mapSerproIntegraResponse(statusCode: number, rawBody: unknown): SerproIntegraResponse {
  if (statusCode >= 400) {
    const err = mapSerproHttpError(statusCode, rawBody);
    return {
      ok: false,
      statusCode,
      rawBody,
      erroCodigo: err.code,
      erroMensagem: err.message
    };
  }

  const protocolo =
    typeof rawBody === "object" &&
    rawBody !== null &&
    "protocolo" in rawBody &&
    typeof (rawBody as { protocolo: unknown }).protocolo === "string"
      ? (rawBody as { protocolo: string }).protocolo
      : typeof rawBody === "object" &&
          rawBody !== null &&
          "dados" in rawBody &&
          typeof (rawBody as { dados: unknown }).dados === "string"
        ? extractProtocoloFromDados((rawBody as { dados: string }).dados)
        : undefined;

  return {
    ok: true,
    statusCode,
    protocolo: protocolo ?? `MOCK-${Date.now()}`,
    rawBody
  };
}

function extractProtocoloFromDados(dados: string): string | undefined {
  try {
    const parsed = JSON.parse(dados) as { protocolo?: string };
    return parsed.protocolo;
  } catch {
    return undefined;
  }
}
