import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import { HttpReceitaFiscalGateway } from "../../src/modules/fiscal-guias/infrastructure/receita/http-receita-fiscal-gateway";

describe("HttpReceitaFiscalGateway — DARF", () => {
  let baseUrl = "";
  let server: http.Server;

  beforeAll(async () => {
    server = http.createServer(async (req, res) => {
      if (req.method !== "POST" || req.url !== "/darf/capture") {
        res.writeHead(404);
        res.end();
        return;
      }
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(chunk as Buffer);
      }
      const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")) as Record<string, unknown>;
      expect(parsed.tipo_guia).toBe("DARF");
      expect(parsed.codigo_receita).toBe("0561");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          valor_principal: 400,
          valor_multa: 0,
          valor_juros: 0,
          data_vencimento: "2026-06-30",
          linha_digitavel: "85600000000400012340201234567890123456789012345",
          pix_copia_cola: "mock-darf-pix",
          compliance_status: "aprovado"
        })
      );
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("Falha ao bind servidor mock DARF.");
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("captura DARF via POST /darf/capture", async () => {
    const gw = new HttpReceitaFiscalGateway({ baseUrl });
    const result = await gw.captureDarf({
      cnpj: "11222333000181",
      competencia: "2026-06",
      codigoReceita: "0561",
      periodoApuracao: "2026-06-30",
      certPem: "unused",
      keyPem: "unused"
    });

    expect(result.valorPrincipal).toBe(400);
    expect(result.complianceStatus).toBe("aprovado");
    expect(result.linhaDigitavel.startsWith("856")).toBe(true);
  });
});
