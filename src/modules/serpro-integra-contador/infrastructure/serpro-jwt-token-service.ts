import type { SerproIntegraRequest } from "../domain/serpro-types";
import type { SerproAuthContext } from "../domain/serpro-auth-context";
import {
  parseSerproProcuradorToken,
  parseSerproProcuradorTokenFromEtag
} from "../domain/serpro-procurador-token";
import { mapSerproIntegraResponse } from "../domain/serpro-error-mapper";
import { serproHttpsRequest } from "./serpro-http-fetch";
import {
  buildSerproTermoAutorizacaoXml,
  encodeSerproTermoXmlBase64,
  signSerproTermoAutorizacaoXml
} from "./serpro-termo-autorizacao";
import { buildSerproEnvioXmlAssinadoRequest } from "./serpro-request-builder";
import {
  getCachedSerproJwtToken,
  setCachedSerproJwtToken
} from "./serpro-jwt-token-cache";

function headerValue(
  headers: Record<string, string | string[] | undefined>,
  name: string
): string | undefined {
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  if (!key) {
    return undefined;
  }
  const v = headers[key];
  return Array.isArray(v) ? v[0] : v;
}

function parseExpiresAt(raw: string | null): Date | null {
  if (!raw?.trim()) {
    return null;
  }
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function documentoTipo(numero: string): "PF" | "PJ" {
  const digits = numero.replace(/\D/g, "");
  return digits.length === 11 ? "PF" : "PJ";
}

function formatSerproError(statusCode: number, parsed: unknown): string {
  if (typeof parsed === "object" && parsed !== null && "mensagens" in parsed) {
    const msgs = (parsed as { mensagens?: Array<{ codigo?: string; texto?: string }> }).mensagens ?? [];
    if (msgs.length > 0) {
      return msgs.map((m) => `${m.codigo ?? "SERPRO"}: ${m.texto ?? ""}`.trim()).join(" | ");
    }
  }
  const preview =
    typeof parsed === "string" ? parsed.slice(0, 400) : JSON.stringify(parsed).slice(0, 400);
  return `SERPRO HTTP ${statusCode}: ${preview}`;
}

export type ObtainSerproJwtTokenInput = {
  cacheKey: string;
  baseUrl: string;
  accessToken: string;
  /** Header jwt_token do SAPI /authenticate (obrigatorio em todas as chamadas Integra Contador). */
  jwtToken: string;
  contratanteCnpj: string;
  contratanteNome: string;
  contribuinteCnpj: string;
  autorDocumento: string;
  autorNome: string;
  autorTipo?: "PF" | "PJ";
  certificadoPem: string;
  chavePrivadaPem: string;
  certificadoValidUntil: string;
};

export async function obtainSerproProcuradorToken(input: ObtainSerproJwtTokenInput): Promise<string> {
  const cached = getCachedSerproJwtToken(input.cacheKey);
  if (cached) {
    return cached;
  }

  const vigencia = new Date(input.certificadoValidUntil);
  if (Number.isNaN(vigencia.getTime())) {
    vigencia.setFullYear(vigencia.getFullYear() + 1);
  }

  const xml = buildSerproTermoAutorizacaoXml({
    contratanteCnpj: input.contratanteCnpj,
    contratanteNome: input.contratanteNome,
    autorDocumento: input.autorDocumento,
    autorNome: input.autorNome,
    autorTipo: input.autorTipo ?? documentoTipo(input.autorDocumento),
    vigenciaAte: vigencia
  });
  const signed = signSerproTermoAutorizacaoXml(xml, input.certificadoPem, input.chavePrivadaPem);
  const xmlBase64 = encodeSerproTermoXmlBase64(signed);

  const body = buildSerproEnvioXmlAssinadoRequest({
    contratanteCnpj: input.contratanteCnpj,
    autorPedidoDocumento: input.autorDocumento,
    contribuinteCnpj: input.contribuinteCnpj,
    xmlBase64
  });

  const url = `${input.baseUrl.replace(/\/$/, "")}/integra-contador/v1/Apoiar`;
  const res = await serproHttpsRequest(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      jwt_token: input.jwtToken,
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }

  if (res.status === 304) {
    const etagToken = parseSerproProcuradorTokenFromEtag(headerValue(res.headers, "etag"));
    if (etagToken) {
      const expiresHeader = headerValue(res.headers, "expires");
      setCachedSerproJwtToken(input.cacheKey, etagToken, expiresHeader ? new Date(expiresHeader) : null);
      return etagToken;
    }
  }

  const mapped = mapSerproIntegraResponse(res.status, parsed);
  if (!mapped.ok) {
    throw new Error(formatSerproError(mapped.statusCode, parsed));
  }

  const tokenPayload = parseSerproProcuradorToken(mapped.rawBody);
  const etagToken = parseSerproProcuradorTokenFromEtag(headerValue(res.headers, "etag"));
  const token = tokenPayload?.token ?? etagToken;
  if (!token) {
    throw new Error("SERPRO nao retornou autenticar_procurador_token.");
  }

  setCachedSerproJwtToken(
    input.cacheKey,
    token,
    parseExpiresAt(tokenPayload?.expiresAt ?? null)
  );
  return token;
}

export function buildSerproAuthContext(
  accessToken: string,
  jwtToken?: string,
  procuradorToken?: string
): SerproAuthContext {
  return {
    accessToken,
    jwtToken: jwtToken?.trim() || undefined,
    procuradorToken: procuradorToken?.trim() || undefined
  };
}

/** @deprecated Use obtainSerproProcuradorToken — ENVIOXMLASSINADO81 (nao confundir com jwt SAPI). */
export const obtainSerproJwtToken = obtainSerproProcuradorToken;

export async function postSerproIntegra(
  baseUrl: string,
  path: string,
  body: SerproIntegraRequest,
  auth: SerproAuthContext
): Promise<ReturnType<typeof mapSerproIntegraResponse>> {
  const url = `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${auth.accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json"
  };
  if (auth.jwtToken) {
    headers.jwt_token = auth.jwtToken;
  }
  if (auth.procuradorToken) {
    headers.autenticar_procurador_token = auth.procuradorToken;
  }
  const res = await serproHttpsRequest(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      parsed = text;
    }
  }
  return mapSerproIntegraResponse(res.status, parsed);
}
