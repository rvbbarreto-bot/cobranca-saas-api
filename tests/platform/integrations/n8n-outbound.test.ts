import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { emitN8nPlatformEvent } from "../../../src/platform/integrations/n8n-outbound";

describe("emitN8nPlatformEvent", () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true });

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
    delete process.env.N8N_PLATFORM_WEBHOOK_URL;
    delete process.env.N8N_PLATFORM_WEBHOOK_SECRET;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("nao chama fetch sem URL configurada", () => {
    emitN8nPlatformEvent({
      event: "charge.paid",
      occurred_at: "2026-05-19T00:00:00.000Z",
      tenant_id: "t1",
      payload: { charge_id: "c1" }
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST no webhook com secret opcional", async () => {
    process.env.N8N_PLATFORM_WEBHOOK_URL = "https://n8n.test/hook";
    process.env.N8N_PLATFORM_WEBHOOK_SECRET = "sec-test";

    emitN8nPlatformEvent({
      event: "charge.paid",
      occurred_at: "2026-05-19T00:00:00.000Z",
      tenant_id: "t1",
      payload: { charge_id: "c1" }
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://n8n.test/hook");
    expect((init.headers as Record<string, string>)["X-Webhook-Secret"]).toBe("sec-test");
    const body = JSON.parse(String(init.body));
    expect(body.event).toBe("charge.paid");
  });
});
