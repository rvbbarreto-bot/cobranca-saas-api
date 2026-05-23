import { describe, expect, it } from "vitest";
import { buildWhatsAppShareUrl, normalizeBrWhatsAppPhone } from "./whatsapp-share";

describe("whatsapp-share", () => {
  it("normaliza celular BR com DDD", () => {
    expect(normalizeBrWhatsAppPhone("(11) 98888-7777")).toBe("5511988887777");
  });

  it("monta link wa.me", () => {
    const url = buildWhatsAppShareUrl("5511999998888", "Olá");
    expect(url).toContain("wa.me/5511999998888");
    expect(url).toContain("text=");
  });
});
