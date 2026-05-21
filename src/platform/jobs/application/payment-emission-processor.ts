import { UnrecoverableError } from "bullmq";
import type { PoolClient } from "pg";
import type { PaymentGatewayAdapter } from "../../../modules/payment-gateway/domain/payment-gateway.interface";
import type { BoletoResult, PixResult } from "../../../modules/payment-gateway/domain/payment-gateway.interface";
import { AsaasAdapter } from "../../../modules/payment-gateway/infrastructure/asaas/asaas-adapter";
import type { CanonicalChargeStatus } from "../../../modules/billing-core/domain/charge";
import { decrypt } from "../../crypto/decrypt";
import { insertChargeEvent } from "../../../modules/billing-core/infrastructure/charge-events-repository";
import { writeAuditLog } from "../../audit/audit.service";
import { emitN8nPlatformEvent } from "../../integrations/n8n-outbound";
import { withTenantTransaction } from "../../persistence/with-tenant-transaction";

export type PaymentEmissionJobData = {
  chargeId: string;
  tenantId: string;
};

export type ChargeRow = {
  id: string;
  tenantId: string;
  reference: string;
  idempotencyKey: string;
  amount: string;
  dueDate: string;
  canonicalStatus: CanonicalChargeStatus;
  type: "boleto" | "pix";
  metadata: Record<string, unknown>;
};

export type PortalClienteEmissionRow = {
  id: string;
  documento: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  gatewayCustomerId: string | null;
};

export type PaymentEmissionProcessorDeps = {
  withTenant?: typeof withTenantTransaction;
  createAdapter?: (apiKey: string) => PaymentGatewayAdapter;
  decryptApiKey?: (ciphertext: string, ivBase64: string) => string;
};

function mapChargeRow(row: Record<string, unknown>): ChargeRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    reference: String(row.reference),
    idempotencyKey: String(row.idempotency_key),
    amount: String(row.amount),
    dueDate:
      row.due_date instanceof Date
        ? row.due_date.toISOString().slice(0, 10)
        : String(row.due_date).slice(0, 10),
    canonicalStatus: row.canonical_status as CanonicalChargeStatus,
    type: (row.type === "pix" ? "pix" : "boleto") as "boleto" | "pix",
    metadata: (row.metadata as Record<string, unknown>) || {}
  };
}

async function loadCharge(
  client: PoolClient,
  chargeId: string,
  tenantId: string
): Promise<ChargeRow> {
  const r = await client.query<Record<string, unknown>>(
    `SELECT id, tenant_id, reference, idempotency_key, amount, due_date,
            canonical_status, type, metadata
     FROM charges
     WHERE id = $1::uuid AND tenant_id = $2::uuid
     LIMIT 1`,
    [chargeId, tenantId]
  );
  const row = r.rows[0];
  if (!row) {
    throw new UnrecoverableError("charge_not_found");
  }
  return mapChargeRow(row);
}

type EscritorioConfigRow = {
  gatewayProvider: string;
  gatewayApiKeyEncrypted: string;
  encryptionIv: string;
};

async function loadEscritorioConfig(
  client: PoolClient,
  tenantId: string
): Promise<EscritorioConfigRow> {
  const r = await client.query<Record<string, unknown>>(
    `SELECT gateway_provider, gateway_api_key_encrypted, encryption_iv
     FROM escritorio_config
     WHERE tenant_id = $1
     LIMIT 1`,
    [tenantId]
  );
  const row = r.rows[0];
  if (!row) {
    throw new UnrecoverableError("escritorio_config_not_found");
  }
  if (!row.gateway_api_key_encrypted || !row.encryption_iv) {
    throw new UnrecoverableError("escritorio_config_not_found");
  }
  return {
    gatewayProvider: String(row.gateway_provider || "asaas"),
    gatewayApiKeyEncrypted: String(row.gateway_api_key_encrypted),
    encryptionIv: String(row.encryption_iv)
  };
}

async function loadPortalCliente(
  client: PoolClient,
  portalClienteId: string,
  automacaoTenantId: string | undefined
): Promise<PortalClienteEmissionRow> {
  const r = automacaoTenantId
    ? await client.query<Record<string, unknown>>(
        `SELECT id, documento, nome, email, telefone, gateway_customer_id
         FROM portal.cliente
         WHERE id = $1::uuid AND tenant_id = $2
         LIMIT 1`,
        [portalClienteId, automacaoTenantId]
      )
    : await client.query<Record<string, unknown>>(
        `SELECT id, documento, nome, email, telefone, gateway_customer_id
         FROM portal.cliente
         WHERE id = $1::uuid
         LIMIT 1`,
        [portalClienteId]
      );
  const row = r.rows[0];
  if (!row) {
    throw new Error(`portal.cliente ${portalClienteId} nao encontrado.`);
  }
  return {
    id: String(row.id),
    documento: String(row.documento),
    nome: String(row.nome),
    email: row.email ? String(row.email) : null,
    telefone: row.telefone ? String(row.telefone) : null,
    gatewayCustomerId: row.gateway_customer_id ? String(row.gateway_customer_id) : null
  };
}

async function insertPaymentTransaction(
  client: PoolClient,
  input: {
    tenantId: string;
    chargeId: string;
    gateway: string;
    gatewayTransactionId: string;
    type: "boleto" | "pix";
    amount: string;
    boleto?: BoletoResult;
    pix?: PixResult;
    gatewayRawResponse?: Record<string, unknown>;
  }
): Promise<void> {
  await client.query(
    `INSERT INTO payment_transactions (
       tenant_id, charge_id, gateway, gateway_transaction_id, type, status, amount,
       boleto_url, boleto_pdf_url, boleto_barcode, pix_qrcode_base64, pix_emv, pix_link,
       expires_at, gateway_raw_response, updated_at
     ) VALUES (
       $1, $2::uuid, $3, $4, $5, 'pending', $6::numeric,
       $7, $8, $9, $10, $11, $12, $13, $14::jsonb, now()
     )`,
    [
      input.tenantId,
      input.chargeId,
      input.gateway,
      input.gatewayTransactionId,
      input.type,
      input.amount,
      input.boleto?.boletoUrl ?? null,
      input.boleto?.boletoPdfUrl ?? null,
      input.boleto?.barCode ?? null,
      input.pix?.pixQrcodeBase64 ?? null,
      input.pix?.pixEmv ?? null,
      input.pix?.pixLink ?? null,
      input.boleto?.expiresAt ?? input.pix?.expiresAt ?? null,
      JSON.stringify(input.gatewayRawResponse ?? {})
    ]
  );
}

function defaultCreateAdapter(apiKey: string): PaymentGatewayAdapter {
  return new AsaasAdapter({
    apiKey,
    baseUrl: process.env.ASAAS_API_URL
  });
}

async function runEmission(
  client: PoolClient,
  data: PaymentEmissionJobData,
  deps: PaymentEmissionProcessorDeps
): Promise<void> {
  const decryptKey = deps.decryptApiKey ?? decrypt;
  const createAdapter = deps.createAdapter ?? defaultCreateAdapter;

  const charge = await loadCharge(client, data.chargeId, data.tenantId);

  if (charge.canonicalStatus !== "rascunho") {
    throw new UnrecoverableError("invalid_status_for_emission");
  }

  const oldStatus = charge.canonicalStatus;

  const config = await loadEscritorioConfig(client, data.tenantId);
  if (config.gatewayProvider !== "asaas") {
    throw new Error(`Gateway ${config.gatewayProvider} ainda nao suportado no worker.`);
  }

  const apiKey = decryptKey(config.gatewayApiKeyEncrypted, config.encryptionIv);
  const adapter = createAdapter(apiKey);

  const portalClienteId = charge.metadata.portal_cliente_id;
  if (typeof portalClienteId !== "string" || !portalClienteId.trim()) {
    throw new Error("charge.metadata.portal_cliente_id obrigatorio para emissao.");
  }

  const automacaoTenantId =
    typeof charge.metadata.portal_automacao_tenant_id === "string"
      ? charge.metadata.portal_automacao_tenant_id.trim()
      : undefined;

  const cliente = await loadPortalCliente(client, portalClienteId.trim(), automacaoTenantId);
  let gatewayCustomerId = cliente.gatewayCustomerId;

  if (!gatewayCustomerId) {
    const email = cliente.email?.trim() || `sem-email+${cliente.id}@cobranca.local`;
    gatewayCustomerId = await adapter.createCustomer({
      name: cliente.nome,
      cpfCnpj: cliente.documento,
      email,
      phone: cliente.telefone ?? undefined,
      externalReference: cliente.id
    });
    await client.query(
      `UPDATE portal.cliente
       SET gateway_customer_id = $2, updated_at = now()
       WHERE id = $1::uuid`,
      [cliente.id, gatewayCustomerId]
    );
  }

  const paymentBase = {
    gatewayCustomerId,
    value: Number(charge.amount),
    dueDate: charge.dueDate,
    description: charge.reference,
    externalReference: charge.idempotencyKey
  };

  let gatewayTransactionId: string;
  let boleto: BoletoResult | undefined;
  let pix: PixResult | undefined;

  if (charge.type === "pix") {
    pix = await adapter.createPix(paymentBase);
    gatewayTransactionId = pix.gatewayTransactionId;
  } else {
    boleto = await adapter.createBoleto(paymentBase);
    gatewayTransactionId = boleto.gatewayTransactionId;
  }

  const gatewayRawResponse = boleto?.providerRaw ?? pix?.providerRaw ?? {};

  await insertPaymentTransaction(client, {
    tenantId: data.tenantId,
    chargeId: charge.id,
    gateway: config.gatewayProvider,
    gatewayTransactionId,
    type: charge.type,
    amount: charge.amount,
    boleto,
    pix,
    gatewayRawResponse
  });

  await client.query(
    `UPDATE charges
     SET canonical_status = 'emitida',
         provider = $3,
         provider_charge_id = $4,
         updated_at = now()
     WHERE id = $1::uuid AND tenant_id = $2::uuid`,
    [charge.id, data.tenantId, config.gatewayProvider, gatewayTransactionId]
  );

  await insertChargeEvent(client, {
    tenantId: data.tenantId,
    chargeId: charge.id,
    eventType: "emissao_gateway",
    oldStatus,
    newStatus: "emitida",
    payload: { gateway_transaction_id: gatewayTransactionId, type: charge.type }
  });

  await writeAuditLog(
    {
      tenantId: data.tenantId,
      action: "status_change",
      resourceType: "charge",
      resourceId: charge.id,
      oldValue: { canonical_status: oldStatus },
      newValue: { canonical_status: "emitida", gateway_transaction_id: gatewayTransactionId }
    },
    client
  );
}

export async function processPaymentEmission(
  data: PaymentEmissionJobData,
  deps: PaymentEmissionProcessorDeps = {}
): Promise<void> {
  const withTenant = deps.withTenant ?? withTenantTransaction;
  await withTenant(data.tenantId, async (client) => {
    await runEmission(client, data, deps);
  });
  emitN8nPlatformEvent({
    event: "charge.emitted",
    occurred_at: new Date().toISOString(),
    tenant_id: data.tenantId,
    payload: { charge_id: data.chargeId }
  });
}

export async function handlePaymentEmissionFailure(
  data: PaymentEmissionJobData,
  error: unknown,
  deps: PaymentEmissionProcessorDeps = {}
): Promise<void> {
  if (error instanceof UnrecoverableError) {
    return;
  }

  const withTenant = deps.withTenant ?? withTenantTransaction;
  const message = error instanceof Error ? error.message : String(error);

  await withTenant(data.tenantId, async (client) => {
    let charge: ChargeRow;
    try {
      charge = await loadCharge(client, data.chargeId, data.tenantId);
    } catch {
      return;
    }

    const oldStatus = charge.canonicalStatus;

    await client.query(
      `UPDATE charges
       SET canonical_status = 'erro_emissao', updated_at = now()
       WHERE id = $1::uuid AND tenant_id = $2::uuid`,
      [data.chargeId, data.tenantId]
    );

    await insertChargeEvent(client, {
      tenantId: data.tenantId,
      chargeId: data.chargeId,
      eventType: "erro_emissao",
      oldStatus,
      newStatus: "erro_emissao",
      payload: { error: message }
    });
  });
}
