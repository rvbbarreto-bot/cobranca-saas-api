/**
 * Bateria QA API — integração Banco Inter (homologação local).
 * Uso: npx tsx scripts/qa-inter-api-battery.ts
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateMtlsPemPair, sanitizePemPaste } from "../src/platform/payment-gateway/mtls-credential-validation.js";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiBase = (process.env.QA_API_BASE_URL ?? "http://localhost:3333").replace(/\/$/, "");
const email = process.env.QA_PORTAL_EMAIL ?? "admin@teste.local";
const tenantSlug = process.env.QA_PORTAL_TENANT ?? "escritorio-demo";
const password = process.env.QA_PORTAL_PASSWORD ?? "TesteDev!2026";
const clienteId = process.env.QA_PORTAL_CLIENTE_ID ?? "f3fa9165-50fd-4fe4-a155-27faafa04068";
const pollMaxSec = Number(process.env.QA_POLL_MAX_SEC ?? "540");

type Result = { id: string; ok: boolean; detail: string };

const results: Result[] = [];

function record(id: string, ok: boolean, detail: string): void {
  results.push({ id, ok, detail });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${id}: ${detail}`);
}

async function http<T>(
  method: string,
  pathname: string,
  opts: { token?: string; tenantId?: string; body?: unknown } = {}
): Promise<{ status: number; data: T; raw: string }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  if (opts.tenantId) headers["x-tenant-id"] = opts.tenantId;
  let body: string | undefined;
  if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${apiBase}${pathname}`, { method, headers, body });
  const raw = await res.text();
  let data: T;
  try {
    data = (raw ? JSON.parse(raw) : {}) as T;
  } catch {
    throw new Error(`${method} ${pathname} → ${res.status}: ${raw.slice(0, 300)}`);
  }
  return { status: res.status, data, raw };
}

function dueDateInter(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 7);
  return d.toISOString().slice(0, 10);
}

function mapSslError(raw: string): string {
  if (/unknown ca|alert number 48/i.test(raw)) {
    return "mTLS: certificado rejeitado pelo Inter (unknown_ca) — revisar PEM/client_id da mesma app";
  }
  if (/bad end line|PEM routines/i.test(raw)) {
    return "PEM inválido no gateway";
  }
  return raw.split("\n")[0]?.slice(0, 200) ?? raw;
}

async function main(): Promise<void> {
  console.log(`\n=== QA API Banco Inter ===\nBase: ${apiBase}\n`);

  // Health
  try {
    const h = await http<{ status: string }>("GET", "/health/ready");
    record("HEALTH", h.status === 200 && h.data.status === "ok", `ready status=${h.data.status}`);
  } catch (e) {
    record("HEALTH", false, e instanceof Error ? e.message : String(e));
    printSummary();
    process.exit(1);
  }

  // PEM local (pacote QA)
  const certPath = path.join(repoRoot, "data", "qa-inter-credentials", "certificate.pem");
  const keyPath = path.join(repoRoot, "data", "qa-inter-credentials", "private_key.pem");
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    const check = validateMtlsPemPair(
      sanitizePemPaste(fs.readFileSync(certPath, "utf8")),
      sanitizePemPaste(fs.readFileSync(keyPath, "utf8"))
    );
    record("PEM-LOCAL", check.ok, check.ok ? "Par cert+chave OK (pacote QA)" : check.message);
  } else {
    record("PEM-LOCAL", false, "Gere com: npm run qa:inter-pem");
  }

  // Login
  let token: string;
  let tenantId: string;
  try {
    const login = await http<{ access_token: string; tenant_id: string; login_kind?: string }>(
      "POST",
      "/v1/portal/auth/login",
      { body: { email, tenant_id: tenantSlug, password } }
    );
    token = login.data.access_token;
    tenantId = login.data.tenant_id;
    record(
      "AUTH",
      login.status === 200 && Boolean(token),
      `login_kind=${login.data.login_kind ?? "portal"} tenant=${tenantId}`
    );
  } catch (e) {
    record("AUTH", false, e instanceof Error ? e.message : String(e));
    printSummary();
    process.exit(1);
  }

  const auth = { token, tenantId };

  // INT-01 providers
  try {
    const prov = await http<{ data: Array<{ id: string; enabled: boolean }> }>(
      "GET",
      "/v1/portal/escritorio/gateway/providers",
      auth
    );
    const inter = prov.data.data?.find((p) => p.id === "inter");
    record(
      "INT-01",
      Boolean(inter?.enabled),
      inter ? `inter enabled=${inter.enabled}` : "inter ausente na lista"
    );
  } catch (e) {
    record("INT-01", false, e instanceof Error ? e.message : String(e));
  }

  // INT-02 schema
  try {
    const schema = await http<{
      provider: { credentialFields: Array<{ key: string; required: boolean }> };
    }>("GET", "/v1/portal/escritorio/gateway/providers/inter/schema", auth);
    const keys = schema.data.provider?.credentialFields?.map((f) => f.key) ?? [];
    const required = ["client_id", "client_secret", "certificate_pem", "private_key_pem"];
    const ok = required.every((k) => keys.includes(k));
    record("INT-02", ok, `campos=${keys.join(",")}`);
  } catch (e) {
    record("INT-02", false, e instanceof Error ? e.message : String(e));
  }

  // INT-03 / INT-04 config
  let gatewayConfigured = false;
  try {
    const cfg = await http<{
      config: {
        gateway_provider?: string;
        gateway_credentials_configured?: boolean;
        gateway_api_key?: string | null;
      };
    }>("GET", "/v1/portal/escritorio/config", auth);
    const c = cfg.data.config;
    gatewayConfigured = Boolean(c?.gateway_provider === "inter" && c.gateway_credentials_configured);
    const leaksPem =
      JSON.stringify(cfg.data).includes("BEGIN CERTIFICATE") ||
      JSON.stringify(cfg.data).includes("BEGIN PRIVATE KEY");
    record(
      "INT-03",
      gatewayConfigured,
      `provider=${c?.gateway_provider} configured=${c?.gateway_credentials_configured}`
    );
    record("INT-04", !leaksPem, leaksPem ? "PEM/secret exposto no GET" : "resposta mascarada");
  } catch (e) {
    record("INT-03", false, e instanceof Error ? e.message : String(e));
    record("INT-04", false, "sem GET config");
  }

  if (!gatewayConfigured) {
    record(
      "INT-05",
      false,
      "Pule emissão: configure Inter em /configuracoes antes (gateway+credenciais)"
    );
    printSummary();
    process.exit(1);
  }

  // INT-05 emissão
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  let chargeId = "";
  try {
    const created = await http<{ charge: { id: string; canonicalStatus: string } }>(
      "POST",
      "/v1/portal/cobrancas",
      {
        ...auth,
        body: {
          reference: `QA-API-${stamp}`,
          idempotency_key: `qa-api-${stamp}`,
          amount: 3.3,
          due_date: dueDateInter(),
          type: "boleto",
          portal_cliente_id: clienteId
        }
      }
    );
    chargeId = created.data.charge.id;
    record(
      "INT-05a",
      created.status === 201 || created.status === 200,
      `charge=${chargeId} status=${created.data.charge.canonicalStatus}`
    );
  } catch (e) {
    record("INT-05a", false, e instanceof Error ? e.message : String(e));
    printSummary();
    process.exit(1);
  }

  const started = Date.now();
  let finalStatus = "rascunho";
  let hasPayment = false;
  let provider: string | null = null;
  let lastErr = "";

  while (Date.now() - started < pollMaxSec * 1000) {
    await new Promise((r) => setTimeout(r, 3000));
    const detail = await http<{
      charge: { canonicalStatus: string; provider?: string | null };
      payment: unknown;
      events: Array<{ event_type: string; payload_json?: { error?: string } }>;
    }>("GET", `/v1/portal/cobrancas/${chargeId}`, auth);

    finalStatus = detail.data.charge.canonicalStatus;
    hasPayment = Boolean(detail.data.payment);
    provider = detail.data.charge.provider ?? null;
    const errEv = [...(detail.data.events ?? [])]
      .reverse()
      .find((ev) => ev.event_type === "erro_emissao");
    if (errEv?.payload_json?.error) {
      lastErr = mapSslError(String(errEv.payload_json.error));
    }

    const elapsed = Math.round((Date.now() - started) / 1000);
    console.log(`  … +${elapsed}s status=${finalStatus} provider=${provider ?? "—"} payment=${hasPayment}`);

    if (finalStatus === "emitida" && hasPayment) break;
    if (finalStatus === "erro_emissao") break;
    if (finalStatus === "cancelada") break;
  }

  const emitted = finalStatus === "emitida" && hasPayment;
  record(
    "INT-05b",
    emitted,
    emitted
      ? `emitida provider=${provider}`
      : lastErr || `status=${finalStatus} após ${pollMaxSec}s (ver workers/Redis)`
  );

  if (chargeId) {
    record("INT-06", hasPayment && provider === "inter", `payment=${hasPayment} provider=${provider}`);
  }

  const evidenceDir = path.join(repoRoot, "docs", "evidencias");
  fs.mkdirSync(evidenceDir, { recursive: true });
  const evidenceFile = path.join(
    evidenceDir,
    `qa-inter-api-battery-${new Date().toISOString().replace(/[:.]/g, "-")}.json`
  );
  fs.writeFileSync(
    evidenceFile,
    JSON.stringify({ ran_at: new Date().toISOString(), results, charge_id: chargeId, lastErr }, null, 2) +
      "\n"
  );
  console.log(`\nEvidência: ${evidenceFile}`);

  printSummary();
  process.exit(results.some((r) => !r.ok) ? 1 : 0);
}

function printSummary(): void {
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n--- Resumo: ${passed}/${results.length} PASS ---\n`);
  for (const r of results) {
    console.log(`  ${r.ok ? "✓" : "✗"} ${r.id}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
