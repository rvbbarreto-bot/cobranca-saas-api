import { describe, expect, it } from "vitest";
import { parseProvisionPublicTenantBody } from "../../src/modules/tenant-provisioning/application/provision-public-tenant";

describe("parseProvisionPublicTenantBody", () => {
  it("aceita slug e nome validos", () => {
    const r = parseProvisionPublicTenantBody({ slug: "novo-escritorio", name: "Nome LTDA", status: "trial" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.slug).toBe("novo-escritorio");
      expect(r.value.status).toBe("trial");
    }
  });

  it("rejeita slug invalido", () => {
    expect(parseProvisionPublicTenantBody({ slug: "A", name: "x" }).ok).toBe(false);
    expect(parseProvisionPublicTenantBody({ slug: "-bad", name: "x" }).ok).toBe(false);
  });
});
