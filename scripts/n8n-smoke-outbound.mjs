/**
 * Smoke: envia os 6 eventos outbound para N8N_PLATFORM_WEBHOOK_URL (homolog QA).
 * Uso: npm run n8n:smoke:outbound
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: join(root, ".env"), override: true });

const DEMO_TENANT = "00000000-0000-4000-8000-000000000001";
const url = process.env.N8N_PLATFORM_WEBHOOK_URL?.trim();
const secret = process.env.N8N_PLATFORM_WEBHOOK_SECRET?.trim();

if (!url) {
  console.error("[n8n:smoke] Defina N8N_PLATFORM_WEBHOOK_URL no .env (URL do webhook n8n).");
  process.exit(1);
}

const samples = [
  { event: "charge.paid", payload: { charge_id: "00000000-0000-4000-8000-00000000a001" } },
  { event: "charge.emitted", payload: { charge_id: "00000000-0000-4000-8000-00000000a002" } },
  { event: "charge.overdue", payload: { charge_id: "00000000-0000-4000-8000-00000000a003" } },
  { event: "charge.cancelled", payload: { charge_id: "00000000-0000-4000-8000-00000000a004" } },
  {
    event: "notification.regua_enqueued",
    payload: { charge_id: "00000000-0000-4000-8000-00000000a005", event_type: "pos_vencimento_3d", days_offset: 3 }
  },
  {
    event: "subscription.past_due",
    payload: {
      subscription_id: "00000000-0000-4000-8000-00000000b001",
      plano_slug: "profissional",
      gateway_subscription_id: "sub_homolog_smoke"
    }
  }
];

let failed = 0;
for (const sample of samples) {
  const body = {
    event: sample.event,
    occurred_at: new Date().toISOString(),
    tenant_id: DEMO_TENANT,
    payload: sample.payload
  };
  const headers = { "Content-Type": "application/json" };
  if (secret) headers["X-Webhook-Secret"] = secret;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const ok = res.ok;
  console.log(`[n8n:smoke] ${sample.event} → HTTP ${res.status} ${ok ? "OK" : "FAIL"}`);
  if (!ok) failed += 1;
}

if (failed > 0) {
  console.error(`[n8n:smoke] ${failed}/${samples.length} falharam. Workflow ativo? Secret alinhado?`);
  process.exit(1);
}
console.log(`[n8n:smoke] ${samples.length}/${samples.length} eventos enviados. Ver execuções no n8n.`);
