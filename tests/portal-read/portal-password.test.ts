import { describe, expect, it } from "vitest";
import { hashPortalPassword, verifyPortalPassword } from "../../src/modules/portal-read/application/portal-password";

describe("portal-password", () => {
  it("hash e verificacao bcrypt", async () => {
    const h = await hashPortalPassword("segredo-forte-123");
    expect(await verifyPortalPassword("segredo-forte-123", h)).toBe(true);
    expect(await verifyPortalPassword("outro", h)).toBe(false);
  });

  it("hash ausente retorna false", async () => {
    expect(await verifyPortalPassword("x", null)).toBe(false);
    expect(await verifyPortalPassword("x", "")).toBe(false);
  });
});
