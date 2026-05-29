import { describe, expect, it } from "vitest";
import {
  buildInterPdfPlaceholder,
  isInterPdfPlaceholder,
  parseInterPdfCodigoSolicitacao,
  portalBoletoPdfApiPath
} from "../../src/modules/payment-gateway/infrastructure/inter/inter-pdf-url";

describe("inter-pdf-url", () => {
  it("detecta placeholder inter", () => {
    expect(isInterPdfPlaceholder("inter://cobranca/abc-123/pdf")).toBe(true);
    expect(isInterPdfPlaceholder("https://x.com/a.pdf")).toBe(false);
  });

  it("extrai codigoSolicitacao", () => {
    expect(parseInterPdfCodigoSolicitacao("inter://cobranca/uuid-1/pdf")).toBe("uuid-1");
  });

  it("monta path do portal", () => {
    expect(portalBoletoPdfApiPath("ch-1")).toBe("/v1/portal/cobrancas/ch-1/boleto.pdf");
  });

  it("buildInterPdfPlaceholder", () => {
    expect(buildInterPdfPlaceholder("x")).toBe("inter://cobranca/x/pdf");
  });
});
