import type { SerproIntegraContadorClient, SerproIntegraRequest, SerproIntegraResponse } from "../domain/serpro-types";
import type { SerproAuthContext } from "../domain/serpro-auth-context";
import { postSerproIntegra } from "./serpro-jwt-token-service";
import { mapSerproIntegraResponse } from "../domain/serpro-error-mapper";
import {
  buildMockSerproPdfBytes,
  extractSerproPdfBytes
} from "../domain/serpro-mock-payload";

function withPdf(res: SerproIntegraResponse): SerproIntegraResponse {
  const pdfBytes = extractSerproPdfBytes(res.rawBody);
  return pdfBytes ? { ...res, pdfBytes } : res;
}

export class MockSerproIntegraContadorClient implements SerproIntegraContadorClient {
  async consultar(request: SerproIntegraRequest, _auth: SerproAuthContext): Promise<SerproIntegraResponse> {
    const servico = request.pedidoDados.idServico;
    if (servico === "OBTERPROCURACAO41") {
      return mapSerproIntegraResponse(200, {
        mock: true,
        operacao: "Consultar",
        servico,
        situacao: "valida"
      });
    }
    if (servico === "CONSDECREC15" || servico === "CONSULTIMADECREC14") {
      return withPdf(
        mapSerproIntegraResponse(200, {
          mock: true,
          operacao: "Consultar",
          servico,
          protocolo: `MOCK-REC-${request.contribuinte.numero}-${Date.now()}`,
          pdfBase64: buildMockSerproPdfBytes("recibo").toString("base64")
        })
      );
    }
    return mapSerproIntegraResponse(200, {
      mock: true,
      operacao: "Consultar",
      servico: request.pedidoDados.idServico,
      protocolo: `MOCK-CONS-${request.contribuinte.numero}-${Date.now()}`
    });
  }

  async declarar(request: SerproIntegraRequest, _auth: SerproAuthContext): Promise<SerproIntegraResponse> {
    return mapSerproIntegraResponse(200, {
      mock: true,
      operacao: "Declarar",
      servico: request.pedidoDados.idServico,
      protocolo: `MOCK-DECL-${request.contribuinte.numero}-${Date.now()}`
    });
  }

  async emitir(request: SerproIntegraRequest, _auth: SerproAuthContext): Promise<SerproIntegraResponse> {
    const pa = JSON.parse(request.pedidoDados.dados || "{}") as { pa?: string; valorDas?: number };
    const valor = typeof pa.valorDas === "number" ? pa.valorDas : 150;
    return withPdf(
      mapSerproIntegraResponse(200, {
        mock: true,
        operacao: "Emitir",
        servico: request.pedidoDados.idServico,
        protocolo: `MOCK-DAS-${request.contribuinte.numero}-${Date.now()}`,
        linhaDigitavel: "85800000000150012340201234567890123456789012345",
        valorPrincipal: valor,
        valorMulta: 0,
        valorJuros: 0,
        dataVencimento: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        pdfBase64: buildMockSerproPdfBytes("das").toString("base64")
      })
    );
  }
}

export class HttpSerproIntegraContadorClient implements SerproIntegraContadorClient {
  constructor(private readonly baseUrl: string) {}

  async consultar(request: SerproIntegraRequest, auth: SerproAuthContext): Promise<SerproIntegraResponse> {
    return withPdf(await this.post("/integra-contador/v1/Consultar", request, auth));
  }

  async declarar(request: SerproIntegraRequest, auth: SerproAuthContext): Promise<SerproIntegraResponse> {
    return this.post("/integra-contador/v1/Declarar", request, auth);
  }

  async emitir(request: SerproIntegraRequest, auth: SerproAuthContext): Promise<SerproIntegraResponse> {
    return withPdf(await this.post("/integra-contador/v1/Emitir", request, auth));
  }

  private async post(
    path: string,
    body: SerproIntegraRequest,
    auth: SerproAuthContext
  ): Promise<SerproIntegraResponse> {
    return postSerproIntegra(this.baseUrl, path, body, auth);
  }
}

export function createSerproIntegraClient(baseUrl: string, useMock: boolean): SerproIntegraContadorClient {
  if (useMock) {
    return new MockSerproIntegraContadorClient();
  }
  return new HttpSerproIntegraContadorClient(baseUrl);
}
