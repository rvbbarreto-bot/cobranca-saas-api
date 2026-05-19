import { describe, expect, it, vi } from "vitest";
import { UnrecoverableError } from "bullmq";
import type { PoolClient } from "pg";
import { NotificationError } from "../../../src/modules/notifications/domain/notification-error";
import {
  limparTelefone,
  processNotificationSend
} from "../../../src/platform/jobs/application/notification-send-processor";

const tenantId = "00000000-0000-4000-8000-000000000001";
const chargeId = "10000000-0000-4000-8000-000000000099";

type CommEvent = {
  channel: string;
  status: string;
  error_message?: string | null;
};

type MockState = {
  charge: {
    canonical_status: string;
    cliente_nome: string;
    cliente_email: string | null;
    cliente_telefone: string | null;
    opt_in_email: boolean;
    opt_in_whatsapp: boolean;
    amount: string;
    due_date: string;
    paid_at: string | null;
    razao_social: string | null;
  } | null;
  emailTemplate: { subject: string | null; body_template: string } | null;
  whatsappTemplate: { subject: string | null; body_template: string } | null;
  payment: { boleto_url: string | null; pix_link: string | null; pix_emv: string | null } | null;
  communicationEvents: CommEvent[];
};

function createMockClient(state: MockState): PoolClient {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => {
      const q = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (q.includes("from charges c") && q.includes("portal.cliente")) {
        if (!state.charge) return { rows: [] };
        const c = state.charge;
        return {
          rows: [
            {
              charge_id: chargeId,
              tenant_id: tenantId,
              canonical_status: c.canonical_status,
              amount: c.amount,
              due_date: c.due_date,
              paid_at: c.paid_at,
              cliente_nome: c.cliente_nome,
              cliente_email: c.cliente_email,
              cliente_telefone: c.cliente_telefone,
              opt_in_email: c.opt_in_email,
              opt_in_whatsapp: c.opt_in_whatsapp,
              razao_social: c.razao_social
            }
          ]
        };
      }

      if (q.startsWith("select channel") && q.includes("charging_rules")) {
        return { rows: [] };
      }

      if (q.includes("from payment_transactions")) {
        return { rows: state.payment ? [state.payment] : [] };
      }

      if (q.includes("from notification_templates")) {
        const channel = params?.[2];
        if (channel === "email") {
          return { rows: state.emailTemplate ? [{ channel: "email", ...state.emailTemplate }] : [] };
        }
        if (channel === "whatsapp") {
          return {
            rows: state.whatsappTemplate ? [{ channel: "whatsapp", ...state.whatsappTemplate }] : []
          };
        }
        return { rows: [] };
      }

      if (q.startsWith("insert into communication_events")) {
        state.communicationEvents.push({
          channel: String(params?.[2]),
          status: String(params?.[5]),
          error_message: (params?.[7] as string | null) ?? null
        });
        return { rowCount: 1 };
      }

      return { rows: [] };
    })
  } as unknown as PoolClient;
}

const baseCharge = (): NonNullable<MockState["charge"]> => ({
  canonical_status: "enviada",
  cliente_nome: "Ana Silva",
  cliente_email: "ana@teste.com",
  cliente_telefone: "(11) 98765-4321",
  opt_in_email: true,
  opt_in_whatsapp: true,
  amount: "1234.56",
  due_date: "2030-06-15",
  paid_at: null,
  razao_social: "Escritório Demo"
});

describe("processNotificationSend", () => {
  it("lembrete email enviado → communication_events status sent", async () => {
    const state: MockState = {
      charge: baseCharge(),
      emailTemplate: {
        subject: "Lembrete {{nome}}",
        body_template: "Olá {{nome}}, valor {{valor}}"
      },
      whatsappTemplate: null,
      payment: null,
      communicationEvents: []
    };

    const sendEmail = vi.fn().mockResolvedValue({ messageId: "resend-1" });
    const sendWhatsApp = vi.fn();

    await processNotificationSend(
      {
        chargeId,
        tenantId,
        eventType: "lembrete_pre_3d",
        forceChannel: "email"
      },
      {
        withTenant: async (_tid, fn) => fn(createMockClient(state)),
        resendAdapter: { sendEmail },
        zapiAdapter: { sendWhatsApp }
      }
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ana@teste.com",
        subject: "Lembrete Ana Silva",
        html: expect.stringContaining("Ana Silva")
      })
    );
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(state.communicationEvents).toEqual([
      expect.objectContaining({ channel: "email", status: "sent" })
    ]);
  });

  it("WhatsApp enviado → telefone limpo + communication_events sent", async () => {
    const state: MockState = {
      charge: baseCharge(),
      emailTemplate: null,
      whatsappTemplate: {
        subject: null,
        body_template: "PIX: {{link_pix}}"
      },
      payment: { boleto_url: null, pix_link: "https://pix", pix_emv: "emv" },
      communicationEvents: []
    };

    const sendEmail = vi.fn();
    const sendWhatsApp = vi.fn().mockResolvedValue({ messageId: "zapi-1" });

    await processNotificationSend(
      {
        chargeId,
        tenantId,
        eventType: "lembrete_pre_3d",
        forceChannel: "whatsapp"
      },
      {
        withTenant: async (_tid, fn) => fn(createMockClient(state)),
        resendAdapter: { sendEmail },
        zapiAdapter: { sendWhatsApp }
      }
    );

    expect(sendWhatsApp).toHaveBeenCalledWith({
      phone: limparTelefone("(11) 98765-4321"),
      message: "PIX: https://pix"
    });
    expect(sendWhatsApp.mock.calls[0]?.[0].phone).toBe("11987654321");
    expect(state.communicationEvents).toEqual([
      expect.objectContaining({ channel: "whatsapp", status: "sent" })
    ]);
  });

  it("opt_in_whatsapp=false → WhatsApp não enviado, sem erro", async () => {
    const state: MockState = {
      charge: { ...baseCharge(), opt_in_whatsapp: false },
      emailTemplate: null,
      whatsappTemplate: {
        subject: null,
        body_template: "não deve enviar"
      },
      payment: null,
      communicationEvents: []
    };

    const sendWhatsApp = vi.fn();

    await processNotificationSend(
      {
        chargeId,
        tenantId,
        eventType: "lembrete_pre_3d",
        forceChannel: "whatsapp"
      },
      {
        withTenant: async (_tid, fn) => fn(createMockClient(state)),
        resendAdapter: { sendEmail: vi.fn() },
        zapiAdapter: { sendWhatsApp }
      }
    );

    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(state.communicationEvents).toHaveLength(0);
  });

  it("cobrança paga → retorno early para lembrete, zero envios", async () => {
    const state: MockState = {
      charge: { ...baseCharge(), canonical_status: "paga" },
      emailTemplate: {
        subject: "x",
        body_template: "y"
      },
      whatsappTemplate: null,
      payment: null,
      communicationEvents: []
    };

    const sendEmail = vi.fn();
    const sendWhatsApp = vi.fn();
    const logs: string[] = [];

    await processNotificationSend(
      {
        chargeId,
        tenantId,
        eventType: "lembrete_pre_3d"
      },
      {
        withTenant: async (_tid, fn) => fn(createMockClient(state)),
        resendAdapter: { sendEmail },
        zapiAdapter: { sendWhatsApp },
        log: (msg) => logs.push(msg)
      }
    );

    expect(sendEmail).not.toHaveBeenCalled();
    expect(sendWhatsApp).not.toHaveBeenCalled();
    expect(state.communicationEvents).toHaveLength(0);
    expect(logs.some((m) => m.includes("estado terminal"))).toBe(true);
  });

  it("NotificationError no Resend → communication_events failed e re-throw", async () => {
    const state: MockState = {
      charge: baseCharge(),
      emailTemplate: {
        subject: "Assunto",
        body_template: "Corpo"
      },
      whatsappTemplate: null,
      payment: null,
      communicationEvents: []
    };

    const err = new NotificationError("Resend falhou", "email", "resend", 422);
    const sendEmail = vi.fn().mockRejectedValue(err);

    await expect(
      processNotificationSend(
        {
          chargeId,
          tenantId,
          eventType: "vencimento_hoje",
          forceChannel: "email"
        },
        {
          withTenant: async (_tid, fn) => fn(createMockClient(state)),
          resendAdapter: { sendEmail },
          zapiAdapter: { sendWhatsApp: vi.fn() }
        }
      )
    ).rejects.toBe(err);

    expect(state.communicationEvents).toEqual([
      expect.objectContaining({
        channel: "email",
        status: "failed",
        error_message: "Resend falhou"
      })
    ]);
  });

  it("magic_link envia e-mail com URL do PORTAL_CLIENT_URL", async () => {
    const prevUrl = process.env.PORTAL_CLIENT_URL;
    process.env.PORTAL_CLIENT_URL = "https://portal.cliente.test";

    const state: MockState = {
      charge: null,
      emailTemplate: {
        subject: "Acesso — {{escritorio_nome}}",
        body_template: "Link: {{magic_link_url}}"
      },
      whatsappTemplate: null,
      payment: null,
      communicationEvents: []
    };

    const sendEmail = vi.fn().mockResolvedValue({ messageId: "msg-magic" });

    await processNotificationSend(
      {
        tenantId,
        eventType: "magic_link",
        forceChannel: "email",
        metadata: {
          token: "raw-token-xyz",
          email: "devedor@test.com",
          tenant_slug: "meu-escritorio"
        }
      },
      {
        withTenant: async (_tid, fn) => fn(createMockClient(state)),
        resendAdapter: { sendEmail },
        zapiAdapter: { sendWhatsApp: vi.fn() }
      }
    );

    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "devedor@test.com",
        html: "Link: https://portal.cliente.test/acesso?token=raw-token-xyz&tenant=meu-escritorio"
      })
    );
    expect(state.communicationEvents).toEqual([
      expect.objectContaining({ channel: "email", status: "sent" })
    ]);

    if (prevUrl === undefined) {
      delete process.env.PORTAL_CLIENT_URL;
    } else {
      process.env.PORTAL_CLIENT_URL = prevUrl;
    }
  });

  it("cobrança não encontrada → UnrecoverableError charge_not_found", async () => {
    const state: MockState = {
      charge: null,
      emailTemplate: null,
      whatsappTemplate: null,
      payment: null,
      communicationEvents: []
    };

    await expect(
      processNotificationSend(
        { chargeId, tenantId, eventType: "lembrete_pre_3d" },
        {
          withTenant: async (_tid, fn) => fn(createMockClient(state)),
          resendAdapter: { sendEmail: vi.fn() },
          zapiAdapter: { sendWhatsApp: vi.fn() }
        }
      )
    ).rejects.toBeInstanceOf(UnrecoverableError);
  });
});
