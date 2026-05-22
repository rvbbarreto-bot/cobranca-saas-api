import { request, expect } from "@playwright/test";
import { config as loadEnv } from "dotenv";
import { join } from "node:path";
import { bddTitle } from "../reporters/evidence-reporter";
import { API_BASE, DEMO_TENANT_UUID } from "../helpers/constants";

import { test } from "../fixtures/test";

loadEnv({ path: join(process.cwd(), ".env"), override: true });

test(bddTitle("Inbox webhook (API)", "Webhook duplicado deduplicado"), async () => {
  const secret = process.env.WEBHOOK_INBOX_SECRET?.trim();
  test.skip(!secret, "WEBHOOK_INBOX_SECRET ausente no .env");

  const api = await request.newContext({
    extraHTTPHeaders: {
      "x-tenant-id": DEMO_TENANT_UUID,
      "X-Webhook-Secret": secret,
      "x-external-event-id": `qa-playwright-${Date.now()}`,
      "x-correlation-id": `qa-corr-${Date.now()}`,
      "content-type": "application/json"
    }
  });

  const payload = {
    event: "PAYMENT_RECEIVED",
    payment: {
      id: `pay_qa_${Date.now()}`,
      status: "RECEIVED",
      externalReference: `qa-ext-${Date.now()}`
    }
  };

  const eventId = `qa-event-${Date.now()}`;
  const headers = {
    "x-tenant-id": DEMO_TENANT_UUID,
    "X-Webhook-Secret": secret,
    "x-external-event-id": eventId,
    "x-correlation-id": `qa-corr-${Date.now()}`
  };

  const first = await api.post(`${API_BASE}/v1/inbox/webhooks`, { headers, data: payload });
  if (first.status() === 401) {
    test.skip(true, "WEBHOOK_INBOX_SECRET do .env não coincide com a API em execução (reinicie docker compose)");
  }
  expect(first.status()).toBe(202);
  const body1 = (await first.json()) as { deduplicated?: boolean; accepted?: boolean };
  expect(body1.deduplicated).toBe(false);
  expect(body1.accepted).toBe(true);

  const second = await api.post(`${API_BASE}/v1/inbox/webhooks`, { headers, data: payload });
  expect(second.status()).toBe(200);
  const body2 = (await second.json()) as { deduplicated?: boolean; accepted?: boolean };
  expect(body2.deduplicated).toBe(true);
  expect(body2.accepted).toBe(true);

  await api.dispose();
});
