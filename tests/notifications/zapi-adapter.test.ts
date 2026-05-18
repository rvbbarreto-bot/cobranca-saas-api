import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ZapiAdapter } from "../../src/modules/notifications/infrastructure/zapi/zapi-adapter";
import { NotificationError } from "../../src/modules/notifications/domain/notification-error";

describe("ZapiAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.ZAPI_INSTANCE_ID = "inst-abc";
    process.env.ZAPI_TOKEN = "tok-xyz";
    process.env.ZAPI_CLIENT_TOKEN = "client-secret";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sendWhatsApp → prefixo 55 aplicado e retorna messageId", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ messageId: "zapi-msg-99" })
    } as Response);

    const adapter = new ZapiAdapter();
    const result = await adapter.sendWhatsApp({
      phone: "11987654321",
      message: "Mensagem de teste"
    });

    expect(result.messageId).toBe("zapi-msg-99");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.z-api.io/instances/inst-abc/token/tok-xyz/send-text",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "Client-Token": "client-secret"
        })
      })
    );

    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body.phone).toBe("5511987654321");
    expect(body.message).toBe("Mensagem de teste");
    expect(body.delayMessage).toBe(2);
  });

  it("erro HTTP → NotificationError whatsapp/zapi", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: "forbidden" })
    } as Response);

    const adapter = new ZapiAdapter();
    await expect(
      adapter.sendWhatsApp({ phone: "11999999999", message: "oi" })
    ).rejects.toMatchObject({
      channel: "whatsapp",
      provider: "zapi",
      statusCode: 403
    } satisfies Partial<NotificationError>);
  });
});
