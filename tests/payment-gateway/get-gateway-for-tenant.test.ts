import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import {
  getGatewayForTenant,
  type AdapterLoader
} from "../../src/modules/payment-gateway/application/get-gateway-for-tenant";
import type { PaymentGatewayAdapter } from "../../src/modules/payment-gateway/domain/payment-gateway.interface";

function mockClient(row: Record<string, unknown> | null): PoolClient {
  return {
    query: vi.fn(async () => ({ rows: row ? [row] : [] }))
  } as unknown as PoolClient;
}

const mockAdapter: PaymentGatewayAdapter = {
  createCustomer: vi.fn(),
  createBoleto: vi.fn(),
  createPix: vi.fn(),
  cancelCharge: vi.fn(),
  getCharge: vi.fn()
};

describe("getGatewayForTenant", () => {
  it("carrega Asaas legado via api_key", async () => {
    const loader: AdapterLoader = vi.fn(() => mockAdapter);
    const client = mockClient({
      gateway_provider: "asaas",
      gateway_api_key_encrypted: "cipher",
      gateway_credentials_encrypted: null,
      encryption_iv: "iv"
    });

    const adapter = await getGatewayForTenant(client, "tenant-1", {
      decrypt: () => "api-key-test",
      sandbox: true,
      loaders: { asaas: loader }
    });

    expect(adapter).toBe(mockAdapter);
    expect(loader).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "asaas",
        credentials: { api_key: "api-key-test" }
      })
    );
  });

  it("carrega Inter com JSON de credenciais", async () => {
    const loader: AdapterLoader = vi.fn(() => mockAdapter);
    const creds = {
      client_id: "id",
      client_secret: "secret",
      certificate_pem: "cert",
      private_key_pem: "key"
    };
    const client = mockClient({
      gateway_provider: "inter",
      gateway_credentials_encrypted: "enc",
      gateway_api_key_encrypted: null,
      encryption_iv: "iv"
    });

    await getGatewayForTenant(client, "tenant-2", {
      decrypt: () => JSON.stringify(creds),
      sandbox: true,
      loaders: { inter: loader }
    });

    expect(loader).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "inter", credentials: creds })
    );
  });
});
