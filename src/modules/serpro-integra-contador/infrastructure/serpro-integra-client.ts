import type { SerproIntegraContadorClient, SerproIntegraRequest, SerproIntegraResponse } from "../domain/serpro-types";
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
  async consultar(request: SerproIntegraRequest, _accessToken: string): Promise<SerproIntegraResponse> {
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

  async declarar(request: SerproIntegraRequest, _accessToken: string): Promise<SerproIntegraResponse> {
    return mapSerproIntegraResponse(200, {
      mock: true,
      operacao: "Declarar",
      servico: request.pedidoDados.idServico,
      protocolo: `MOCK-DECL-${request.contribuinte.numero}-${Date.now()}`
    });
  }

  async emitir(request: SerproIntegraRequest, _accessToken: string): Promise<SerproIntegraResponse> {
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

  async consultar(request: SerproIntegraRequest, accessToken: string): Promise<SerproIntegraResponse> {
    return withPdf(await this.post("/integra-contador/v1/Consultar", request, accessToken));
  }

  async declarar(request: SerproIntegraRequest, accessToken: string): Promise<SerproIntegraResponse> {
    return this.post("/integra-contador/v1/Declarar", request, accessToken);
  }

  async emitir(request: SerproIntegraRequest, accessToken: string): Promise<SerproIntegraResponse> {
    return withPdf(await this.post("/integra-contador/v1/Emitir", request, accessToken));
  }

  private async post(
    path: string,
    body: SerproIntegraRequest,
    accessToken: string
  ): Promise<SerproIntegraResponse> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    let raw: unknown;
    try {
      raw = await res.json();
    } catch {
      raw = { raw: await res.text() };
    }
    return mapSerproIntegraResponse(res.status, raw);
  }
}

export function createSerproIntegraClient(baseUrl: string, useMock: boolean): SerproIntegraContadorClient {
  if (useMock) {
    return new MockSerproIntegraContadorClient();
  }
  return new HttpSerproIntegraContadorClient(baseUrl);
}
