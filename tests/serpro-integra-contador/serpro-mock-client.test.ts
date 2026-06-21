import { describe, expect, it } from "vitest";

import { createSerproIntegraClient } from "../../src/modules/serpro-integra-contador/infrastructure/serpro-integra-client";

import { buildSerproPgdasdTransmitRequest } from "../../src/modules/serpro-integra-contador/infrastructure/serpro-request-builder";

import { parsePgdasdPedidoDados } from "../../src/modules/serpro-integra-contador/domain/pgdasd-transmissao-payload";

import { sampleCanonicalApuracao } from "../fixtures/pgdasd-sample-apuracao";



describe("MockSerproIntegraContadorClient", () => {

  it("declarar retorna protocolo mock", async () => {

    const client = createSerproIntegraClient("https://demo.example", true);

    const req = buildSerproPgdasdTransmitRequest({

      contratanteCnpj: "00000000000191",

      contribuinteCnpj: "00000000000191",

      apuracao: sampleCanonicalApuracao()

    });

    const dados = parsePgdasdPedidoDados(req.pedidoDados.dados);

    expect(dados.cnpjCompleto).toBe("00000000000191");



    const res = await client.declarar(req, { accessToken: "token" });

    expect(res.ok).toBe(true);

    expect(res.protocolo).toMatch(/^MOCK-DECL-/);

  });

});


