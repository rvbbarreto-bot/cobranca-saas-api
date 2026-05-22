import { describe, expect, it, vi } from "vitest";
import {
  getCachedOAuthToken,
  setCachedOAuthToken
} from "../../../src/platform/payment-gateway/oauth-token-cache";

describe("oauth-token-cache", () => {
  it("armazena e recupera token com margem de TTL", async () => {
    const store = new Map<string, string>();
    const deps = {
      get: vi.fn(async (key: string) => store.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => {
        store.set(key, value);
      })
    };

    await setCachedOAuthToken("inter", "tenant-1", "token-abc", 3600, 60, deps);
    const token = await getCachedOAuthToken("inter", "tenant-1", deps);
    expect(token).toBe("token-abc");
    expect(deps.set).toHaveBeenCalledOnce();
  });

  it("retorna null quando cache ausente", async () => {
    const token = await getCachedOAuthToken("cora", "tenant-x", {
      get: async () => null,
      set: async () => undefined
    });
    expect(token).toBeNull();
  });
});
