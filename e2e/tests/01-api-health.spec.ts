import { request, expect } from "@playwright/test";
import { bddTitle } from "../reporters/evidence-reporter";
import { API_BASE } from "../helpers/constants";

import { test } from "../fixtures/test";

test(bddTitle("Saúde da API", "Liveness responde OK"), async () => {
  const api = await request.newContext();
  const res = await api.get(`${API_BASE}/health`);
  expect(res.status()).toBe(200);
  const body = (await res.json()) as { status?: string };
  expect(body.status).toBe("ok");
  await api.dispose();
});

test(bddTitle("Saúde da API", "Readiness com banco migrado"), async () => {
  const api = await request.newContext();
  const res = await api.get(`${API_BASE}/health/ready`);
  expect(res.status()).toBe(200);
  await api.dispose();
});
