import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import {
  DEMO_PUBLIC_TENANT_UUID,
  runSeedPortalHappyPath,
  SEED_AUTOMACAO_SLUG,
  SEED_PORTAL_EMAIL
} from "../../src/dev/seed-portal-happy-path";
import { closePool } from "../../src/platform/persistence/pool";
import { withTenantTransaction } from "../../src/platform/persistence/with-tenant-transaction";
import { uniqueTestCnpj } from "../../src/modules/portal-read/application/br-cpf-cnpj";

const hasDb = Boolean(process.env.DATABASE_URL?.trim());

const enqueueSpy = vi.fn();

vi.mock("../../src/platform/jobs/enqueue-payment-emission", () => ({
  schedulePaymentEmissionJob: (charge: { id: string; tenantId: string }) => {
    enqueueSpy(charge);
  },
  enqueuePaymentEmissionJob: vi.fn()
}));

describe.skipIf(!hasDb)("Portal cobranca: POST enfileira emissao + GET payment PIX", () => {
  let app: ReturnType<typeof import("../../src/app").createApp>;
  let tokenPortal = "";
  let automacaoTenantId = "";

  beforeAll(async () => {
    const { createApp } = await import("../../src/app");
    app = createApp();
    enqueueSpy.mockClear();

    const seed = await runSeedPortalHappyPath(process.env.DATABASE_URL!.trim());
    automacaoTenantId = seed.automacaoTenantId;

    const rPortal = await request(app)
      .post("/v1/portal/auth/token/mock")
      .send({ email: SEED_PORTAL_EMAIL, tenant_id: automacaoTenantId });
    expect(rPortal.status).toBe(200);
    tokenPortal = rPortal.body.access_token as string;
  });

  afterAll(async () => {
    await closePool();
  });

  it("POST /v1/portal/cobrancas → 201 rascunho + job enfileirado; GET /:id retorna payment com QR PIX", async () => {
    const documento = uniqueTestCnpj(Date.now() + 42_000, 701);
    const clienteRes = await request(app)
      .post("/v1/portal/clientes")
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .send({
        documento,
        nome: "Cliente fluxo emissao",
        email: "fluxo@test.local",
        whatsapp_opt_in: false
      })
      .expect(201);
    const portalClienteId = clienteRes.body.cliente.id as string;

    const ref = `emissao-flow-${Date.now()}`;
    const idem = `idem-emissao-${Date.now()}`;

    enqueueSpy.mockClear();

    const created = await request(app)
      .post("/v1/portal/cobrancas")
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .send({
        reference: ref,
        idempotency_key: idem,
        amount: 150.5,
        due_date: "2032-12-01",
        type: "pix",
        portal_cliente_id: portalClienteId
      })
      .expect(201);

    expect(created.body?.charge?.canonicalStatus).toBe("rascunho");
    expect(created.body?.idempotent).toBe(false);

    const chargeId = created.body.charge.id as string;
    const tenantId = created.body.charge.tenantId as string;

    expect(enqueueSpy).toHaveBeenCalledTimes(1);
    expect(enqueueSpy).toHaveBeenCalledWith({
      id: chargeId,
      tenantId
    });

    await withTenantTransaction(DEMO_PUBLIC_TENANT_UUID, async (client) => {
      await client.query(
        `INSERT INTO payment_transactions (
           tenant_id, charge_id, gateway, gateway_transaction_id, type, status, amount,
           pix_qrcode_base64, pix_emv, boleto_url, boleto_pdf_url, updated_at
         ) VALUES ($1, $2::uuid, 'asaas', $3, 'pix', 'pending', 150.50,
           $4, $5, NULL, NULL, now())`,
        [
          tenantId,
          chargeId,
          `pay_test_${Date.now()}`,
          "iVBORw0KGgoQRmock",
          "00020126580014BR.GOV.BCB.PIX"
        ]
      );
      await client.query(
        `UPDATE charges SET canonical_status = 'emitida', updated_at = now()
         WHERE id = $1::uuid`,
        [chargeId]
      );
    });

    const detail = await request(app)
      .get(`/v1/portal/cobrancas/${chargeId}`)
      .set("Authorization", `Bearer ${tokenPortal}`)
      .set("x-tenant-id", SEED_AUTOMACAO_SLUG)
      .expect(200);

    expect(detail.body?.payment).toMatchObject({
      type: "pix",
      pix_qrcode_base64: "iVBORw0KGgoQRmock",
      pix_emv: "00020126580014BR.GOV.BCB.PIX",
      boleto_url: null,
      boleto_pdf_url: null
    });
  });
});
