import { apiUrl, ApiError, formatPortalNetworkError } from "./api";
import { STORAGE_EXEQ_ACCESS_TOKEN, STORAGE_EXEQ_EMAIL } from "./storageKeys";

export type PortalModuleKey =
  | "cobranca"
  | "clientes"
  | "notas_fiscais"
  | "fiscal_guias"
  | "relatorios";

export type PortalModuleFlags = Record<PortalModuleKey, boolean>;

export const PORTAL_MODULE_LABELS: Record<PortalModuleKey, string> = {
  cobranca: "Boletos / Cobrança",
  clientes: "Clientes",
  notas_fiscais: "Notas fiscais",
  fiscal_guias: "Guias fiscais (DAS/DARF)",
  relatorios: "Relatórios / CSV"
};

export type ExeqLoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: { id: string; email: string; full_name: string | null };
};

export type ExeqMeResponse = {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    role: "exeq_platform_master";
  };
};

export type EscritorioRow = {
  automacaoTenantId: string;
  slug: string | null;
  name: string | null;
  active: boolean;
  publicTenantId: string | null;
  publicTenantSlug: string | null;
  publicTenantStatus: string | null;
  adminCount: number;
  operadorCount: number;
  modules: PortalModuleFlags;
  moduleLabels: typeof PORTAL_MODULE_LABELS;
};

export type EscritorioMembership = {
  membershipId: string;
  appUserId: string;
  email: string;
  fullName: string | null;
  role: "admin_escritorio" | "operador";
  createdAt: string;
};

export type CreateEscritorioBody = {
  slug: string;
  name: string;
  status?: "trial" | "active" | "suspended";
  billing_email?: string;
  modules?: Partial<PortalModuleFlags>;
  admin: {
    email: string;
    full_name: string;
    password: string;
    role?: "admin_escritorio" | "operador";
  };
};

export type AddEscritorioAccessBody = {
  email: string;
  full_name: string;
  password: string;
  role: "admin_escritorio" | "operador";
};

function getExeqToken(): string | null {
  return localStorage.getItem(STORAGE_EXEQ_ACCESS_TOKEN);
}

export function hasExeqSession(): boolean {
  return Boolean(getExeqToken());
}

export function saveExeqSession(token: string, email: string): void {
  localStorage.setItem(STORAGE_EXEQ_ACCESS_TOKEN, token);
  localStorage.setItem(STORAGE_EXEQ_EMAIL, email);
}

export function clearExeqSession(): void {
  localStorage.removeItem(STORAGE_EXEQ_ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_EXEQ_EMAIL);
}

async function exeqFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = getExeqToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const url = apiUrl(path);
  try {
    const res = await fetch(url, { ...init, headers });
    if (res.status === 401) {
      clearExeqSession();
      window.dispatchEvent(new CustomEvent("exeq:unauthorized"));
    }
    return res;
  } catch (error) {
    throw formatPortalNetworkError(url, error);
  }
}

async function parseJsonResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    const msg =
      typeof json === "object" && json !== null && "message" in json && typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, json);
  }
  return json as T;
}

export async function exeqLogin(body: { email: string; password: string }): Promise<ExeqLoginResponse> {
  const res = await exeqFetch("/v1/exeq/auth/login", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return parseJsonResponse(res);
}

export async function fetchExeqMe(): Promise<ExeqMeResponse> {
  const res = await exeqFetch("/v1/exeq/auth/me", { method: "GET" });
  return parseJsonResponse(res);
}

export async function fetchEscritorios(): Promise<{ data: EscritorioRow[]; count: number }> {
  const res = await exeqFetch("/v1/exeq/escritorios", { method: "GET" });
  return parseJsonResponse(res);
}

export async function fetchEscritorioDetail(
  escritorioId: string
): Promise<{ escritorio: EscritorioRow; memberships: EscritorioMembership[] }> {
  const res = await exeqFetch(`/v1/exeq/escritorios/${encodeURIComponent(escritorioId)}`, {
    method: "GET"
  });
  return parseJsonResponse(res);
}

export async function createEscritorio(body: CreateEscritorioBody): Promise<unknown> {
  const res = await exeqFetch("/v1/exeq/escritorios", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return parseJsonResponse(res);
}

export type PatchEscritorioBody = {
  name?: string;
  active?: boolean;
  modules?: Partial<PortalModuleFlags>;
  primary_admin?: {
    app_user_id: string;
    email?: string;
    full_name?: string;
    password?: string;
  };
};

export async function patchEscritorio(
  escritorioId: string,
  body: PatchEscritorioBody
): Promise<{ escritorio: EscritorioRow }> {
  const res = await exeqFetch(`/v1/exeq/escritorios/${encodeURIComponent(escritorioId)}`, {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  return parseJsonResponse(res);
}

export async function updateEscritorioModules(
  escritorioId: string,
  modules: Partial<PortalModuleFlags>
): Promise<{ automacao_tenant_id: string; modules: PortalModuleFlags }> {
  const res = await exeqFetch(`/v1/exeq/escritorios/${encodeURIComponent(escritorioId)}/modules`, {
    method: "PATCH",
    body: JSON.stringify({ modules })
  });
  return parseJsonResponse(res);
}

export async function addEscritorioAccess(
  escritorioId: string,
  body: AddEscritorioAccessBody
): Promise<unknown> {
  const res = await exeqFetch(`/v1/exeq/escritorios/${encodeURIComponent(escritorioId)}/access`, {
    method: "POST",
    body: JSON.stringify(body)
  });
  return parseJsonResponse(res);
}

export function slugifyEscritorioName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
