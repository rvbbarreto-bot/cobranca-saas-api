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
  const loginBody = (await loginRes.json()) as {
    access_token?: string;
    tenant_id?: string;
  };
  const token = loginBody.access_token?.trim();
  const automacaoTenantId = loginBody.tenant_id?.trim() ?? "";
  if (!token || !automacaoTenantId) {
    return null;
  }

  const meRes = await request.get(`${API_BASE}/v1/portal/auth/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-tenant-id": automacaoTenantId
    }
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
    automacaoTenantId: me.tenant?.id ?? automacaoTenantId,
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

  const res = await request.post(`${API_BASE}/v1/portal/clientes`, {
    headers,
    data: {
      documento: FISCAL_E2E_CNPJ,
      tipo_documento: "cnpj",
      nome: "Empresa PGDASD E2E Playwright",
      email: "pgdasd-playwright-e2e@local.dev"
    }
  });
  if (!res.ok() && res.status() !== 409) {
    throw new Error(`ensureFiscalPortalLiveSeed: POST clientes falhou (${res.status()})`);
  }
}
