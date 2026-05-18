import { describe, expect, it } from "vitest";
import {
  chargeCursorFromCharge,
  clienteCursorFromRow,
  decodePortalCursor,
  encodePortalCursor,
  nfCursorFromNotaRow,
  parseChargeListCursor,
  parseClienteListCursor,
  parseNfListCursor,
  parsePortalListLimit
} from "../../src/modules/portal-read/application/portal-list-cursor";

describe("parsePortalListLimit", () => {
  it("default 50", () => {
    expect(parsePortalListLimit(undefined)).toBe(50);
  });
  it("cap 200", () => {
    expect(parsePortalListLimit(999)).toBe(200);
  });
  it("floor invalid", () => {
    expect(parsePortalListLimit("x")).toBe(50);
  });
});

describe("cursors charge/cliente/nf", () => {
  it("roundtrip charge", () => {
    const s = chargeCursorFromCharge({
      id: "11111111-1111-4111-8111-111111111111",
      createdAt: "2020-01-02T03:04:05.000Z"
    });
    const p = parseChargeListCursor(s);
    expect(p).not.toBe("invalid");
    expect(p).not.toBeNull();
    if (p && p !== "invalid") {
      expect(p.id).toBe("11111111-1111-4111-8111-111111111111");
      expect(p.ca).toContain("2020-01-02");
    }
  });

  it("roundtrip cliente", () => {
    const s = clienteCursorFromRow({ id: "22222222-2222-4222-8222-222222222222", nome: "Abel" });
    const p = parseClienteListCursor(s);
    expect(p).not.toBe("invalid");
    if (p && p !== "invalid") {
      expect(p.nome).toBe("Abel");
    }
  });

  it("nf cursor com created_at null", () => {
    const s = nfCursorFromNotaRow({ id: "42", created_at: null });
    expect(s).toBeTruthy();
    const p = parseNfListCursor(s!);
    expect(p).not.toBe("invalid");
    if (p && p !== "invalid") {
      expect(p.id).toBe("42");
      expect(p.ca).toBeNull();
    }
  });

  it("cursor invalido", () => {
    expect(parseChargeListCursor("not-base64!!!")).toBe("invalid");
    expect(parseClienteListCursor(encodePortalCursor({ k: "chg", v: 1, ca: "x", id: "bad" }))).toBe("invalid");
  });

  it("decodePortalCursor null", () => {
    expect(decodePortalCursor(undefined)).toBeNull();
  });
});
