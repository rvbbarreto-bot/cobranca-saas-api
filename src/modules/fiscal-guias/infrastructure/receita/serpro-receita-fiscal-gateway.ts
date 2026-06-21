import { ReceitaGatewayError } from "../../domain/receita-gateway-error";
import type {
  ReceitaCaptureResult,
  ReceitaDasCaptureInput,
  ReceitaDarfCaptureInput,
  ReceitaFiscalGateway
} from "../../domain/receita-gateway.interface";
import { extractSerproDasPayload } from "../../../serpro-integra-contador/domain/serpro-mock-payload";
import type { SerproIntegraContadorClient } from "../../../serpro-integra-contador/domain/serpro-types";
import type { SerproAuthContext } from "../../../serpro-integra-contador/domain/serpro-auth-context";
import {
  buildSerproEmitDasRequest,
  buildSerproEmitDarfRequest
} from "../../../serpro-integra-contador/infrastructure/serpro-request-builder";

export type SerproReceitaFiscalGatewayConfig = {
  client: SerproIntegraContadorClient;
  auth: SerproAuthContext;
  contratanteCnpj: string;
  autorPedidoDocumento?: string;
};

function mapSerproDasToCapture(rawBody: unknown, fallbackValor: number): ReceitaCaptureResult {
  const das = extractSerproDasPayload(rawBody);
  return {
    valorPrincipal: das.valorPrincipal ?? fallbackValor,
    valorMulta: das.valorMulta ?? 0,
    valorJuros: das.valorJuros ?? 0,
    dataVencimento:
      das.dataVencimento ?? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    linhaDigitavel:
      das.linhaDigitavel ?? "85800000000150012340201234567890123456789012345",
    complianceStatus: "aprovado"
  };
}

/**
 * Captura DAS/DARF via Integra Contador (GERARDAS12 / DARF SERPRO).
 * Usado quando RECEITA_GATEWAY_PROVIDER=serpro (mock ou live via client injetado).
 */
export class SerproReceitaFiscalGateway implements ReceitaFiscalGateway {
  constructor(private readonly config: SerproReceitaFiscalGatewayConfig) {}

  async captureDas(input: ReceitaDasCaptureInput): Promise<ReceitaCaptureResult> {
    const req = buildSerproEmitDasRequest({
      contratanteCnpj: this.config.contratanteCnpj,
      contribuinteCnpj: input.cnpj.replace(/\D/g, ""),
      autorPedidoDocumento: this.config.autorPedidoDocumento ?? input.cnpj.replace(/\D/g, ""),
      competencia: input.competencia,
      valorDas: 150
    });

    const res = await this.config.client.emitir(req, this.config.auth);
    if (!res.ok) {
      throw new ReceitaGatewayError("Falha ao emitir DAS via SERPRO.", {
        code: res.erroCodigo ?? "serpro_das_erro",
        providerBody: res.rawBody
      });
    }

    return mapSerproDasToCapture(res.rawBody, 150);
  }

  async captureDarf(input: ReceitaDarfCaptureInput): Promise<ReceitaCaptureResult> {
    const req = buildSerproEmitDarfRequest({
      contratanteCnpj: this.config.contratanteCnpj,
      contribuinteCnpj: input.cnpj.replace(/\D/g, ""),
      autorPedidoDocumento: this.config.autorPedidoDocumento ?? input.cnpj.replace(/\D/g, ""),
      competencia: input.competencia,
      codigoReceita: input.codigoReceita.replace(/\D/g, ""),
      periodoApuracao: input.periodoApuracao
    });

    const res = await this.config.client.emitir(req, this.config.auth);
    if (!res.ok) {
      throw new ReceitaGatewayError("Falha ao emitir DARF via SERPRO.", {
        code: res.erroCodigo ?? "serpro_darf_erro",
        providerBody: res.rawBody
      });
    }

    return mapSerproDasToCapture(res.rawBody, 320);
  }
}
