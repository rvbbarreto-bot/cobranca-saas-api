import { describe, expect, it } from "vitest";
import { parsePortalMembershipRole } from "../../src/shared/types/portal-membership";

describe("parsePortalMembershipRole", () => {
  it("aceita os tres papeis conhecidos", () => {
    expect(parsePortalMembershipRole("admin_escritorio")).toBe("admin_escritorio");
    expect(parsePortalMembershipRole("operador")).toBe("operador");
    expect(parsePortalMembershipRole("cliente_cnpj")).toBe("cliente_cnpj");
  });

  it("rejeita valores desconhecidos", () => {
    expect(parsePortalMembershipRole("admin")).toBe(null);
    expect(parsePortalMembershipRole("")).toBe(null);
  });
});
