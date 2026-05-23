import { describe, expect, it, vi } from "vitest";
import type { PoolClient } from "pg";
import { patchGatewayProviderUseCase } from "../../src/modules/portal-read/application/change-gateway-provider";
import { TEST_INTER_GATEWAY_CREDENTIALS } from "../fixtures/mtls-test-pem";

vi.mock("../../src/platform/crypto/symmetric-encryption", () => ({
  encryptAes256Gcm: vi.fn(() => ({ ciphertext: "enc", iv: "iv123456789012" }))
}));

const tenantId = "tenant-1";

function mockClient(rows: { config?: Record<string, unknown> }): PoolClient {
  let config = rows.config ?? {
    tenant_id: tenantId,
    gateway_provider: "asaas",
    gateway_api_key_encrypted: "old",
    gateway_credentials_encrypted: null,
    encryption_iv: "iv123456789012"
  };

  return {
    query: vi.fn(async (sql: string) => {
      const q = sql.replace(/\s+/g, " ").toLowerCase();
      if (q.includes("from escritorio_config")) {
        return { rows: [config] };
      }
      if (q.startsWith("insert into gateway_change_log")) {
        return { rowCount: 1, rows: [] };
      }
      if (q.startsWith("insert into escritorio_config")) {
        config = {
          ...config,
          gateway_provider: "inter",
          gateway_credentials_encrypted: "newenc"
        };
        return {
          rows: [
            {
              tenant_id: tenantId,
              cnpj_emissor: null,
              razao_social: null,
              inscricao_municipal: null,
              regime_tributario: null,
              codigo_municipio: null,
              aliquota_iss: null,
              gateway_provider: "inter",
              gateway_api_key_encrypted: null,
              gateway_credentials_encrypted: "newenc",
              encryption_iv: "iv123456789012",
              whatsapp_provider: null,
              whatsapp_token_encrypted: null
            }
          ]
        };
      }
      return { rows: [] };
    })
  } as unknown as PoolClient;
}

describe("patchGatewayProviderUseCase", () => {
  it("permite troca asaas -> inter com credenciais e regista log", async () => {
    const client = mockClient({});
    const result = await patchGatewayProviderUseCase(client, tenantId, {
      gateway_provider: "inter",
      gateway_credentials: { ...TEST_INTER_GATEWAY_CREDENTIALS }
    });

    expect(result?.gateway_provider).toBe("inter");
    const calls = (client.query as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.toLowerCase().includes("gateway_change_log"))).toBe(true);
  });
});
