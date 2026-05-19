import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { PaymentGatewayAdapter } from "../../src/modules/payment-gateway/domain/payment-gateway.interface";
import {
  DEMO_PUBLIC_TENANT_UUID,
  runSeedPortalHappyPath,
  SEED_AUTOMACAO_SLUG,
  SEED_PORTAL_EMAIL
} from "../../src/dev/seed-portal-happy-path";
import { upsertEscritorioAsaasConfig } from "../../src/dev/upsert-escritorio-asaas-config";
import { closePool } from "../../src/platform/persistence/pool";
import { withTenantTransaction } from "../../src/platform/persistence/with-tenant-transaction";
import { uniqueTestCnpj } from "../../src/modules/portal-read/application/br-cpf-cnpj";
import { processPaymentEmission } from "../../src/platform/jobs/application/payment-emission-processor";
import { insertWebhookInbox } from "../../src/modules/inbox/infrastructure/webhook-inbox-repository";
import { processPendingWebhooksForTenant } from "../../src/modules/inbox/application/process-webhook-inbox";
import {
  cancelReguaJobsForCharge,
  enqueuePaymentConfirmedNotification
} from "../../src/platform/jobs/enqueue-notification";
import { processNotificationSend } from "../../src/platform/jobs/application/notification-send-processor";
import { CSV_EXPORT_HEADERS } from "../../src/modules/portal-read/application/escritorio-cobrancas-export";
import { verifyAccessToken } from "../../src/modules/identity-access/application/jwt-service";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

const { emissionScheduleSpy, notificationEnqueueSpy, cancelReguaSpy } = vi.hoisted(() => ({
  emissionScheduleSpy: vi.fn(),
  notificationEnqueueSpy: vi.fn(),
  cancelReguaSpy: vi.fn().mockResolvedValue(undefined)
}));
let capturedMagicLinkToken = "";

vi.mock("../../src/platform/jobs/redis-connection", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../src/platform/jobs/redis-connection")>();
  return {
    ...mod,
    isJobsEnabled: () => true
  };
});

vi.mock("../../src/platform/jobs/enqueue-payment-emission", () => ({
  schedulePaymentEmissionJob: (charge: { id: string; tenantId: string }) => {
    emissionScheduleSpy(charge);
  },
  enqueuePaymentEmissionJob: vi.fn()
}));

vi.mock("../../src/platform/jobs/enqueue-notification", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../src/platform/jobs/enqueue-notification")>();
  return {
    ...mod,
    enqueueNotificationJob: vi.fn(async (payload, options) => {
      notificationEnqueueSpy(payload, options);
      if (payload.eventType === "magic_link" && payload.metadata?.token) {
        capturedMagicLinkToken = payload.metadata.token;
      }
    }),
    enqueuePaymentConfirmedNotification: vi.fn(async (payload) => {
      notificationEnqueueSpy(payload, { jobName: "payment-confirmed" });
    }),
    enqueueReguaNotificationJob: vi.fn(async (payload, options) => {
      notificationEnqueueSpy(payload, { jobName: "regua", ...options });
    }),
    cancelReguaJobsForCharge: cancelReguaSpy
  };
});

describe.skipIf(!hasDb)("Sprint 3 — fluxo ponta a ponta (integracao)", () => {
  let app: ReturnType<typeof import("../../src/app").createApp>;
  let tokenPortal = "";
  let automacaoTenantId = "";
  let portalClienteId = "";
  let chargeId = "";
  let gatewayPaymentId = "";
  let clienteEmail = "";
  const clienteNome = "Cliente Sprint3 E2E";

  beforeAll(async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.JWT_SECRET = process.env.JWT_SECRET?.trim() || "sprint3-e2e-jwt-secret";
    process.env.ENCRYPTION_KEY =
      process.env.ENCRYPTION_KEY?.trim() || "a".repeat(64);
    process.env.PORTAL_CLIENT_URL = process.env.PORTAL_CLIENT_URL || "http://localhost:5173";

    const { createApp } = await import("../../src/app");
    app = createApp();

    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    automacaoTenantId = seed.automacaoTenantId;

    await withTenantTransaction(DEMO_PUBLIC_TENANT_UUID, async (client) => {
      await upsertEscritorioAsaasConfig(client, DEMO_PUBLIC_TENANT_UUID, "fake-asaas-key-for-e2e");
      await client.query(
        `INSERT INTO escritorio_config (tenant_id, razao_social)
         VALUES ($1, $2)
         ON CONFLICT (tenant_id) DO UPDATE SET razao_social = EXCLUDED.razao_social`,
        [DEMO_PUBLIC_TENANT_UUID, "Escritorio Demo E2E"]
      );
    });

    const rPortal = await request(app)
      .post("/v1/portal/auth/token/mock")
      .send({ email: SEED_PORTAL_EMAIL, tenant_id: automacaoTenantId });
    expect(rPortal.status).toBe(200);
    tokenPortal = rPortal.body.access_token as string;
  }, 60_000);

  afterAll(async () => {
    await closePool();
  });

  it(
    "fluxo completo: PIX → paga → magic link → portal cliente → dashboard → CSV",
    async () => {
      emissionScheduleSpy.mockClear();
      notificationEnqueueSpy.mockClear();
      capturedMagicLinkToken = "";

      const documento = uniqueTestCnpj(Date.now() + 99_001, 801);
      clienteEmail = `sprint3-e2e+${Date.now()}@local.dev`;

      const clienteRes = await request(app)
        .post("/v1/portal/clientes")
        .set("Authorization", `Bearer ${tokenPortal}`)
        .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
        .send({
          documento,
          nome: clienteNome,
          email: clienteEmail,
          whatsapp_opt_in: false
        })
        .expect(201);
      portalClienteId = clienteRes.body.cliente.id as string;

      const ref = `sprint3-e2e-${Date.now()}`;
      const idem = `idem-sprint3-${Date.now()}`;
      gatewayPaymentId = `pay_sprint3_${Date.now()}`;

      const created = await request(app)
        .post("/v1/portal/cobrancas")
        .set("Authorization", `Bearer ${tokenPortal}`)
        .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
        .send({
          reference: ref,
          idempotency_key: idem,
          amount: 250.75,
          due_date: "2032-12-01",
          type: "pix",
          portal_cliente_id: portalClienteId
        })
        .expect(201);

      expect(created.body?.charge?.canonicalStatus).toBe("rascunho");
      chargeId = created.body.charge.id as string;
      const publicTenantId = created.body.charge.tenantId as string;
      expect(publicTenantId).toBe(DEMO_PUBLIC_TENANT_UUID);

      expect(emissionScheduleSpy).toHaveBeenCalledWith({
        id: chargeId,
        tenantId: publicTenantId
      });

      const mockAdapter: PaymentGatewayAdapter = {
        createCustomer: vi.fn().mockResolvedValue("cust_sprint3_e2e"),
        createPix: vi.fn().mockResolvedValue({
          gatewayTransactionId: gatewayPaymentId,
          pixQrcodeBase64: "iVBORw0KGgoQRmockSprint3",
          pixEmv: "00020126580014BR.GOV.BCB.PIXSPRINT3",
          expiresAt: null,
          providerRaw: { e2e: true }
        }),
        createBoleto: vi.fn(),
        getCharge: vi.fn(),
        cancelCharge: vi.fn()
      };

      await processPaymentEmission(
        { chargeId, tenantId: publicTenantId },
        {
          createAdapter: () => mockAdapter,
          decryptApiKey: () => "fake-asaas-key-for-e2e"
        }
      );

      const afterEmit = await request(app)
        .get(`/v1/portal/cobrancas/${chargeId}`)
        .set("Authorization", `Bearer ${tokenPortal}`)
        .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
        .expect(200);

      expect(afterEmit.body.charge.canonicalStatus).toBe("emitida");
      expect(afterEmit.body.payment?.pix_qrcode_base64).toBeTruthy();

      await withTenantTransaction(DEMO_PUBLIC_TENANT_UUID, async (client) => {
        await insertWebhookInbox(client, {
          source: "asaas",
          externalEventId: `sprint3-e2e-${gatewayPaymentId}`,
          payload: {
            event: "PAYMENT_CONFIRMED",
            payment: {
              id: gatewayPaymentId,
              externalReference: idem
            }
          },
          correlationId: `corr-${Date.now()}`
        });
      });

      const proc = await processPendingWebhooksForTenant(DEMO_PUBLIC_TENANT_UUID, 20);
      expect(proc.updated).toBeGreaterThanOrEqual(1);

      const afterPay = await request(app)
        .get(`/v1/portal/cobrancas/${chargeId}`)
        .set("Authorization", `Bearer ${tokenPortal}`)
        .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
        .expect(200);
      expect(afterPay.body.charge.canonicalStatus).toBe("paga");

      notificationEnqueueSpy.mockClear();
      cancelReguaSpy.mockClear();
      await cancelReguaJobsForCharge(chargeId);
      await enqueuePaymentConfirmedNotification({
        chargeId,
        tenantId: DEMO_PUBLIC_TENANT_UUID,
        eventType: "pagamento_confirmado"
      });
      expect(notificationEnqueueSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "pagamento_confirmado",
          chargeId
        }),
        expect.objectContaining({ jobName: "payment-confirmed" })
      );
      expect(cancelReguaSpy).toHaveBeenCalledWith(chargeId);

      await request(app)
        .post("/v1/portal/cliente/auth/request-access")
        .send({ email: clienteEmail, tenant_slug: SEED_AUTOMACAO_SLUG })
        .expect(200);

      expect(capturedMagicLinkToken.length).toBeGreaterThan(10);

      await processNotificationSend(
        {
          tenantId: automacaoTenantId,
          eventType: "magic_link",
          forceChannel: "email",
          metadata: {
            token: capturedMagicLinkToken,
            email: clienteEmail,
            tenant_slug: SEED_AUTOMACAO_SLUG,
            escritorio_nome: "Escritorio Demo E2E"
          }
        },
        {
          resendAdapter: {
            sendEmail: vi.fn().mockResolvedValue({ messageId: "msg-magic-e2e" })
          }
        }
      );

      const comm = await withTenantTransaction(automacaoTenantId, async (client) => {
        const r = await client.query<{ status: string; event_type: string }>(
          `SELECT status, event_type FROM communication_events
           WHERE tenant_id = $1 AND event_type = 'magic_link' AND recipient = $2
           ORDER BY created_at DESC LIMIT 1`,
          [automacaoTenantId, clienteEmail]
        );
        return r.rows[0];
      });
      expect(comm?.status).toBe("sent");

      const verifyRes = await request(app)
        .post("/v1/portal/cliente/auth/verify-token")
        .send({ token: capturedMagicLinkToken, tenant_slug: SEED_AUTOMACAO_SLUG })
        .expect(200);

      expect(verifyRes.body.token).toBeTruthy();
      const clienteJwt = verifyRes.body.token as string;
      const claims = verifyAccessToken(clienteJwt);
      expect(claims.roles).toContain("cliente_cnpj");

      const listCliente = await request(app)
        .get("/v1/portal/cliente/cobrancas")
        .set("Authorization", `Bearer ${clienteJwt}`)
        .set("x-tenant-id", automacaoTenantId)
        .expect(200);

      const ids = (listCliente.body.data as { id: string }[]).map((c) => c.id);
      expect(ids).toContain(chargeId);

      const detailCliente = await request(app)
        .get(`/v1/portal/cliente/cobrancas/${chargeId}`)
        .set("Authorization", `Bearer ${clienteJwt}`)
        .set("x-tenant-id", automacaoTenantId)
        .expect(200);

      expect(detailCliente.body.canonical_status).toBe("paga");
      const events = detailCliente.body.events as { new_status: string | null }[];
      expect(events.some((e) => e.new_status === "paga")).toBe(true);

      const dash = await request(app)
        .get("/v1/portal/escritorio/dashboard")
        .query({ periodo: "30d" })
        .set("Authorization", `Bearer ${tokenPortal}`)
        .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
        .expect(200);

      expect(dash.body.cobrancas.valor_total_recebido).toBeGreaterThan(0);
      expect(dash.body.cobrancas.taxa_conversao).toBeGreaterThanOrEqual(0);

      const csvRes = await request(app)
        .get("/v1/portal/escritorio/cobrancas/export")
        .query({ format: "csv" })
        .set("Authorization", `Bearer ${tokenPortal}`)
        .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
        .expect(200);

      expect(csvRes.headers["content-type"]).toMatch(/text\/csv/);
      const lines = String(csvRes.text).trim().split("\n");
      expect(lines[0]).toBe(CSV_EXPORT_HEADERS.join(","));
      expect(lines.length).toBeGreaterThan(1);
      expect(lines.some((l) => l.includes("***"))).toBe(true);
    },
    120_000
  );
});
