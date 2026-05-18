import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ResendAdapter } from "../../src/modules/notifications/infrastructure/resend/resend-adapter";
import { NotificationError } from "../../src/modules/notifications/domain/notification-error";

describe("ResendAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.RESEND_API_KEY = "re_test";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("envia email com sucesso", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "msg-1" })
    } as Response);

    const adapter = new ResendAdapter();
    const result = await adapter.sendEmail({
      to: "a@b.com",
      subject: "Teste",
      html: "<p>oi</p>"
    });
    expect(result.messageId).toBe("msg-1");
  });

  it("falha com NotificationError quando HTTP erro", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "unauthorized" })
    } as Response);

    const adapter = new ResendAdapter();
    await expect(
      adapter.sendEmail({ to: "a@b.com", subject: "x", html: "y" })
    ).rejects.toBeInstanceOf(NotificationError);
  });
});
