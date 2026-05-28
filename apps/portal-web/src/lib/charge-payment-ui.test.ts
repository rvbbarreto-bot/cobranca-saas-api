import { describe, expect, it } from "vitest";
import { isUsableHttpUrl } from "./charge-payment-ui";

describe("isUsableHttpUrl", () => {
  it("aceita https", () => {
    expect(isUsableHttpUrl("https://example.com/b.pdf")).toBe(true);
  });

  it("rejeita placeholder inter://", () => {
    expect(isUsableHttpUrl("inter://charge/abc/pdf")).toBe(false);
  });

  it("aceita proxy relativo do portal Inter (/boleto.pdf)", () => {
    expect(isUsableHttpUrl("/v1/portal/cobrancas/ch-1/boleto.pdf")).toBe(true);
  });
});
