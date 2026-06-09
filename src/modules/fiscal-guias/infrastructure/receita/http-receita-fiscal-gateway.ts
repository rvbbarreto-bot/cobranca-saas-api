import { ReceitaGatewayError } from "../../domain/receita-gateway-error";
import type {
  ReceitaDasCaptureInput,
  ReceitaDarfCaptureInput,
  ReceitaFiscalGateway
} from "../../domain/receita-gateway.interface";
import { postReceitaCaptureJson, isReceitaTlsInsecure } from "./http-receita-capture-client";
import { parseReceitaCaptureResponse } from "./receita-capture-response";

export type HttpReceitaFiscalGatewayConfig = {
  baseUrl: string;
  timeoutMs?: number;
};

export { isReceitaTlsInsecure };

/** @deprecated use isReceitaTlsInsecure */
export const isReceitaDasTlsInsecure = isReceitaTlsInsecure;

/**
 * Gateway HTTP Receita DAS + DARF (mTLS com certificado A1 do cliente).
 * Contrato: ADR sec. 12 (DAS) e sec. 15 (DARF).
 */
export class HttpReceitaFiscalGateway implements ReceitaFiscalGateway {
  constructor(private readonly config: HttpReceitaFiscalGatewayConfig) {}

  async captureDas(input: ReceitaDasCaptureInput) {
    return this.capture("DAS", "/das/capture", {
      cnpj: input.cnpj.replace(/\D/g, ""),
      competencia: input.competencia,
      tipo_guia: "DAS",
      procurador_documento: input.procuradorDocumento?.replace(/\D/g, "") ?? null
    }, input);
  }

  async captureDarf(input: ReceitaDarfCaptureInput) {
    return this.capture("DARF", "/darf/capture", {
      cnpj: input.cnpj.replace(/\D/g, ""),
      competencia: input.competencia,
      tipo_guia: "DARF",
      codigo_receita: input.codigoReceita.replace(/\D/g, ""),
      periodo_apuracao: input.periodoApuracao,
      procurador_documento: input.procuradorDocumento?.replace(/\D/g, "") ?? null
    }, input);
  }

  private async capture(
    label: "DAS" | "DARF",
    path: string,
    body: Record<string, unknown>,
    mtls: { certPem: string; keyPem: string }
  ) {
    let parsed: unknown;
    try {
      parsed = await postReceitaCaptureJson({
        baseUrl: this.config.baseUrl,
        path,
        body,
        certPem: mtls.certPem,
        keyPem: mtls.keyPem,
        gatewayLabel: label
      });
    } catch (error: unknown) {
      if (error instanceof ReceitaGatewayError) {
        throw error;
      }
      throw new ReceitaGatewayError(`Falha ao capturar ${label} na Receita.`, {
        code: "receita_gateway_error",
        cause: error
      });
    }

    try {
      return parseReceitaCaptureResponse(parsed);
    } catch (error: unknown) {
      throw new ReceitaGatewayError(`Resposta Receita ${label} invalida.`, {
        code: "receita_response_invalid",
        providerBody: parsed,
        cause: error
      });
    }
  }
}

export function getReceitaCaptureUrl(): string | null {
  const url = process.env.RECEITA_DAS_CAPTURE_URL?.trim();
  return url || null;
}

/** @deprecated use getReceitaCaptureUrl */
export const getReceitaDasCaptureUrl = getReceitaCaptureUrl;

export function createReceitaFiscalGateway(): ReceitaFiscalGateway | null {
  const url = getReceitaCaptureUrl();
  if (!url) {
    return null;
  }
  return new HttpReceitaFiscalGateway({ baseUrl: url });
}

/** @deprecated use createReceitaFiscalGateway */
export function createReceitaDasGateway(): ReceitaFiscalGateway | null {
  return createReceitaFiscalGateway();
}

/** @deprecated use HttpReceitaFiscalGateway */
export const HttpReceitaDasGateway = HttpReceitaFiscalGateway;
