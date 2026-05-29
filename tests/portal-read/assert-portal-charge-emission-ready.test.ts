import { describe, expect, it, vi, beforeEach } from "vitest";
import type { PoolClient } from "pg";
import {
  assertPortalChargeEmissionReady,
  PortalEmissionNotReadyError
} from "../../src/modules/portal-read/application/assert-portal-charge-emission-ready";
import type { Charge } from "../../src/modules/billing-core/domain/charge";

const resolvePortalChargeRules = vi.fn();
const assertPortalClienteHasEmissionAddress = vi.fn();

vi.mock("../../src/modules/portal-read/application/validate-portal-charge-create", () => ({
  resolvePortalChargeRules: (...args: unknown[]) => resolvePortalChargeRules(...args)
}));

vi.mock("../../src/modules/portal-read/application/portal-cliente-emission-address", () => ({
  assertPortalClienteHasEmissionAddress: (...args: unknown[]) =>
    assertPortalClienteHasEmissionAddress(...args),
  PORTAL_CLIENTE_ADDRESS_REQUIRED: "PORTAL_CLIENTE_ADDRESS_REQUIRED"
}));

const baseCharge: Charge = {
  id: "c1",
  tenantId: "t1",
  reference: "ref",
  idempotencyKey: "idem",
  amount: "10",
  dueDate: "2030-01-01",
  canonicalStatus: "erro_emissao",
  provider: null,
  providerChargeId: null,
  metadata: { portal_cliente_id: "cli-1" },
  createdAt: "2020-01-01T00:00:00.000Z",
  updatedAt: "2020-01-01T00:00:00.000Z"
};

describe("assertPortalChargeEmissionReady", () => {
  const client = {} as PoolClient;

  beforeEach(() => {
    vi.clearAllMocks();
    resolvePortalChargeRules.mockResolvedValue({
      displayName: "Banco Inter",
      requiresPayerAddress: true
    });
    assertPortalClienteHasEmissionAddress.mockResolvedValue(undefined);
  });

  it("exige cliente vinculado", async () => {
    await expect(
      assertPortalChargeEmissionReady(client, "auto-1", {
        ...baseCharge,
        metadata: {}
      })
    ).rejects.toBeInstanceOf(PortalEmissionNotReadyError);
  });

  it("valida endereco quando gateway exige", async () => {
    await assertPortalChargeEmissionReady(client, "auto-1", baseCharge);
    expect(assertPortalClienteHasEmissionAddress).toHaveBeenCalledWith(
      client,
      "auto-1",
      "cli-1",
      "Banco Inter"
    );
  });
});
