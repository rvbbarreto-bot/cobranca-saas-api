import { request } from "@playwright/test";
import { API_BASE, PORTAL_BASE } from "./helpers/constants";

export default async function globalSetup(): Promise<void> {
  const api = await request.newContext();
  const portal = await request.newContext();

  const health = await api.get(`${API_BASE}/health`);
  if (!health.ok()) {
    throw new Error(
      `API indisponível em ${API_BASE}/health (${health.status()}). Execute: npm run dev:up`
    );
  }

  const ready = await api.get(`${API_BASE}/health/ready`);
  if (!ready.ok()) {
    throw new Error(
      `API readiness falhou (${ready.status()}). Rode: npm run migrate && npm run seed:dev`
    );
  }

  try {
    const portalProbe = await portal.get(PORTAL_BASE, { timeout: 5_000 });
    if (!portalProbe.ok()) {
      console.warn(`[e2e setup] Portal ${PORTAL_BASE} respondeu ${portalProbe.status()} — inicie: npm run portal:dev`);
    }
  } catch {
    throw new Error(`Portal indisponível em ${PORTAL_BASE}. Execute: npm run portal:dev`);
  }

  await api.dispose();
  await portal.dispose();
}
