import type { APIRequestContext } from "@playwright/test";
import { API_BASE, SEED_EMAIL, SEED_PASSWORD, SEED_TENANT } from "./constants";
import { FISCAL_E2E_CNPJ } from "./fiscal-portal";

export type FiscalPortalApiSession = {
  token: string;
  automacaoTenantId: string;
  fiscalEnabled: boolean;
};

export async function loginFiscalPortalApi(
  request: APIRequestContext
): Promise<FiscalPortalApiSession | null> {
  const loginRes = await request.post(`${API_BASE}/v1/portal/auth/login`, {
    data: {
      email: SEED_EMAIL,
      tenant_id: SEED_TENANT,
      password: SEED_PASSWORD
    }
  });
  if (!loginRes.ok()) {
    return null;
  }
  const loginBody = (await loginRes.json()) as { access_token?: string; tenant?: { id?: string } };
  const token = loginBody.access_token?.trim();
  if (!token) {
    return null;
  }

  const meRes = await request.get(`${API_BASE}/v1/portal/me`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!meRes.ok()) {
    return null;
  }
  const me = (await meRes.json()) as {
    tenant?: { id?: string };
    modules?: { fiscal_guias?: boolean };
  };

  return {
    token,
    automacaoTenantId: me.tenant?.id ?? loginBody.tenant?.id ?? "",
    fiscalEnabled: Boolean(me.modules?.fiscal_guias)
  };
}

/** Garante cliente PGDASD e organização para ingest live (best-effort). */
export async function ensureFiscalPortalLiveSeed(
  request: APIRequestContext,
  session: FiscalPortalApiSession
): Promise<void> {
  const headers = {
    Authorization: `Bearer ${session.token}`,
    "x-tenant-id": session.automacaoTenantId
  };

  await request.post(`${API_BASE}/v1/portal/clientes`, {
    headers,
    data: {
      documento: FISCAL_E2E_CNPJ,
      tipo_documento: "cnpj",
      nome: "Empresa PGDASD E2E Playwright",
      email: "pgdasd-playwright-e2e@local.dev"
    }
  });
}
