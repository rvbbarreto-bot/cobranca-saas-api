/**
 * QA ponta a ponta: login portal → criar cobrança boleto → aguardar emissão Inter.
 *
 * Uso (raiz do repo, API :3333, Redis/workers ativos):
 *   npx tsx scripts/qa-inter-charge-emission.ts
 *
 * Variáveis opcionais:
 *   QA_API_BASE_URL          default http://localhost:3333
 *   QA_PORTAL_EMAIL          default admin@teste.local
 *   QA_PORTAL_TENANT         default escritorio-demo
 *   QA_PORTAL_PASSWORD       default TesteDev!2026
 *   QA_PORTAL_CLIENTE_ID     UUID do pagador (senão: primeiro cliente listado)
 *   QA_POLL_MAX_SEC          default 540 (fila emissão: até 5 tentativas ~8 min)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  sanitizePemPaste,
  validateMtlsPemPair
} from "../src/platform/payment-gateway/mtls-credential-validation.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiBase = (process.env.QA_API_BASE_URL ?? "http://localhost:3333").replace(/\/$/, "");
const portalEmail = process.env.QA_PORTAL_EMAIL ?? "admin@teste.local";
const portalTenant = process.env.QA_PORTAL_TENANT ?? "escritorio-demo";
const portalPassword = process.env.QA_PORTAL_PASSWORD ?? "TesteDev!2026";
const defaultClienteId = "f3fa9165-50fd-4fe4-a155-27faafa04068";
const pollMaxSec = Number(process.env.QA_POLL_MAX_SEC ?? "540");
const forcedClienteId = process.env.QA_PORTAL_CLIENTE_ID?.trim() || defaultClienteId;

type Json = Record<string, unknown>;

async function request<T = Json>(
  method: string,
  pathname: string,
  options: { token?: string; tenantId?: string; body?: unknown } = {}
): Promise<{ status: number; data: T }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }
  if (options.tenantId) {
    headers["x-tenant-id"] = options.tenantId;
  }
  let body: string | undefined;
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const res = await fetch(`${apiBase}${pathname}`, { method, headers, body });
  const text = await res.text();
  let data: T;
  try {
    data = (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new Error(`${method} ${pathname} → ${res.status}: ${text.slice(0, 400)}`);
  }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} → ${res.status}: ${JSON.stringify(data)}`);
  }
  return { status: res.status, data };
}

function localPemCheck(): void {
  const certPath = path.join(repoRoot, "data", "qa-inter-credentials", "certificate.pem");
  const keyPath = path.join(repoRoot, "data", "qa-inter-credentials", "private_key.pem");
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.log(
      "[pem] Pacote local ausente. Gere com: npx tsx scripts/generate-qa-inter-pem-bundle.ts"
    );
    return;
  }
  const cert = sanitizePemPaste(fs.readFileSync(certPath, "utf8"));
  const key = sanitizePemPaste(fs.readFileSync(keyPath, "utf8"));
  const check = validateMtlsPemPair(cert, key);
  console.log(
    `[pem] Pacote QA (Inter API): ${check.ok ? "par cert+chave OK no Node" : check.message}`
  );
}

function mapEmissionError(raw: string): string {
  if (/unknown ca|alert number 48/i.test(raw)) {
    return (
      "Certificado rejeitado pelo Banco Inter (unknown_ca): não é o certificado mTLS da " +
      "aplicação sandbox, está expirado, ou não pertence ao client_id configurado. " +
      "Use Inter API_Certificado.crt + Inter API_Chave.key do Portal Developers, não e-CNPJ."
    );
  }
  if (/bad end line|PEM routines/i.test(raw)) {
    return "PEM com formato inválido (linhas extras, paste incompleto ou arquivo errado).";
  }
  if (/key values mismatch/i.test(raw)) {
    return "Certificado e chave privada não formam o mesmo par.";
  }
  return raw.split("\n")[0]?.slice(0, 240) ?? raw;
}

function dueDateMinInter(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  console.log(`[qa] API ${apiBase}`);
  localPemCheck();

  const login = await request<{ access_token: string; tenant_id: string }>("POST", "/v1/portal/auth/login", {
    body: { email: portalEmail, tenant_id: portalTenant, password: portalPassword }
  });
  const token = login.data.access_token;
  const tenantId = login.data.tenant_id;
  console.log(`[qa] Login OK tenant=${tenantId}`);

  const cfg = await request<{ config?: { gateway_provider?: string }; gateway_credentials_configured?: boolean }>(
    "GET",
    "/v1/portal/escritorio/config",
    { token, tenantId }
  );
  console.log(
    `[qa] Gateway: ${cfg.data.config?.gateway_provider ?? "?"} creds_configured=${String(cfg.data.gateway_credentials_configured)}`
  );

  const clientes = await request<{
    data?: Array<{ id: string; nome?: string; documento?: string }>;
    items?: Array<{ id: string; nome?: string; documento?: string }>;
  }>("GET", "/v1/portal/clientes?limit=20", { token, tenantId });
  const items = clientes.data.data ?? clientes.data.items ?? [];
  if (items.length === 0) {
    throw new Error("Nenhum cliente no portal. Cadastre um pagador antes do QA.");
  }
  let cliente = forcedClienteId ? items.find((c) => c.id === forcedClienteId) : undefined;
  if (!cliente && forcedClienteId) {
    cliente = { id: forcedClienteId, nome: "(id QA — fora da primeira página)" };
  }
  if (!cliente) {
    cliente = items[0];
  }
  if (!cliente?.id) {
    throw new Error("Nenhum cliente disponível para QA.");
  }
  console.log(`[qa] Cliente: ${cliente.nome ?? cliente.id} (${cliente.documento ?? "—"})`);

  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const idempotencyKey = `qa-inter-${stamp}`;
  const createBody = {
    reference: `QA Inter ${stamp}`,
    idempotency_key: idempotencyKey,
    amount: 3.3,
    due_date: dueDateMinInter(),
    type: "boleto" as const,
    portal_cliente_id: cliente.id
  };

  const created = await request<{ charge: { id: string; canonicalStatus: string } }>(
    "POST",
    "/v1/portal/cobrancas",
    { token, tenantId, body: createBody }
  );
  const chargeId = created.data.charge.id;
  console.log(`[qa] Cobrança criada ${chargeId} status=${created.data.charge.canonicalStatus}`);

  const started = Date.now();
  let lastStatus = "";
  let lastError = "";
  let payment = false;

  while (Date.now() - started < pollMaxSec * 1000) {
    await new Promise((r) => setTimeout(r, 3000));
    const detail = await request<{
      charge: { canonicalStatus: string; provider?: string | null };
      payment: unknown;
      events: Array<{ event_type: string; payload_json?: { error?: string } }>;
    }>("GET", `/v1/portal/cobrancas/${chargeId}`, { token, tenantId });

    lastStatus = detail.data.charge.canonicalStatus;
    payment = Boolean(detail.data.payment);
    const errEv = [...(detail.data.events ?? [])]
      .reverse()
      .find((e) => e.event_type === "erro_emissao");
    if (errEv?.payload_json?.error) {
      lastError = mapEmissionError(String(errEv.payload_json.error));
    }

    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(
      `[qa] +${elapsed}s status=${lastStatus} payment=${payment} provider=${detail.data.charge.provider ?? "—"}`
    );

    if (lastStatus === "emitida" && payment) {
      break;
    }
    if (lastStatus === "erro_emissao") {
      break;
    }
    if (lastStatus === "cancelada") {
      break;
    }
  }

  const evidenceDir = path.join(repoRoot, "docs", "evidencias");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = path.join(
    evidenceDir,
    `qa-inter-charge-emission-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  const evidence = {
    ran_at: new Date().toISOString(),
    api_base: apiBase,
    charge_id: chargeId,
    idempotency_key: idempotencyKey,
    cliente_id: cliente.id,
    final_status: lastStatus,
    has_payment: payment,
    last_emission_error: lastError || null,
    detail_url: `http://localhost:5173/cobrancas/${chargeId}`
  };
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");

  console.log("\n--- Resultado QA ---");
  console.log(JSON.stringify(evidence, null, 2));
  console.log(`\nEvidência: ${evidencePath}`);

  if (lastStatus === "emitida" && payment) {
    console.log("\n[qa] SUCESSO — emissão Inter concluída.");
    process.exit(0);
  }
  if (lastError) {
    console.log(`\n[qa] FALHA — ${lastError}`);
    process.exit(1);
  }
  console.log("\n[qa] TIMEOUT — emissão não concluiu no prazo (verifique workers/Redis).");
  process.exit(1);
}

main().catch((e) => {
  console.error("[qa] Erro:", e instanceof Error ? e.message : e);
  process.exit(1);
});
