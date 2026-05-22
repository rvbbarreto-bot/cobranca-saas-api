export const API_BASE = process.env.E2E_API_URL ?? "http://localhost:3333";
export const PORTAL_BASE = process.env.E2E_PORTAL_URL ?? "http://localhost:5173";

export const SEED_EMAIL = process.env.E2E_PORTAL_EMAIL ?? "portal-seed@local.dev";
export const SEED_TENANT = process.env.E2E_PORTAL_TENANT ?? "escritorio-demo";
export const SEED_PASSWORD = process.env.E2E_PORTAL_PASSWORD ?? "PortalSeedDev!ChangeMe1";

export const DEMO_TENANT_UUID = "00000000-0000-4000-8000-000000000001";

export const EVIDENCE_DIR = "docs/evidencias";
export const SCENARIOS_MD = `${EVIDENCE_DIR}/cenarios_testes.md`;
export const ASAAS_RESULT_JSON = `${EVIDENCE_DIR}/asaas-e2e-result.json`;
