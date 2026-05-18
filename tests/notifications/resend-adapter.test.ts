import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ResendAdapter } from "../../src/modules/notifications/infrastructure/resend/resend-adapter";
import { NotificationError } from "../../src/modules/notifications/domain/notification-error";

describe("ResendAdapter", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_FROM_EMAIL = "cobrancas@teste.com.br";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sendEmail → POST correto e retorna messageId", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ id: "msg-resend-1" })
    } as Response);

    const adapter = new ResendAdapter();
    const result = await adapter.sendEmail({
      to: "cliente@teste.com",
      subject: "Assunto",
      html: "<p>Ola</p>"
    });

    expect(result.messageId).toBe("msg-resend-1");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer re_test",
          "Content-Type": "application/json"
        })
      })
    );

    const init = vi.mocked(fetch).mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      from: "cobrancas@teste.com.br",
      to: ["cliente@teste.com"],
      subject: "Assunto",
      html: "<p>Ola</p>"
    });
  });

  it("erro HTTP 422 → NotificationError com channel email e provider resend", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ message: "validation_error" })
    } as Response);

    const adapter = new ResendAdapter();
    await expect(
      adapter.sendEmail({ to: "a@b.com", subject: "x", html: "y" })
    ).rejects.toMatchObject({
      name: "NotificationError",
      channel: "email",
      provider: "resend",
      statusCode: 422
    } satisfies Partial<NotificationError>);
  });
});
