import {
  STORAGE_ACCESS_TOKEN,
  STORAGE_CLIENTE_TENANT_ID,
  STORAGE_CLIENTE_TOKEN,
  STORAGE_EMAIL,
  STORAGE_TENANT_ID
} from "./storageKeys";

/** Base sem barra final. Vazio = URLs relativas `/v1/...` (proxy Vite em dev). */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!raw) {
    return "";
  }
  return raw.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const base = getApiBase();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}

export type PortalLoginResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

export type ChargeRow = {
  id: string;
  reference: string;
  amount: string;
  dueDate: string;
  type?: "boleto" | "pix";
  canonicalStatus: string;
  provider?: string | null;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

/** Última transação de gateway (GET /v1/portal/cobrancas/:id). */
export type PortalChargePayment = {
  type: "boleto" | "pix";
  boleto_url: string | null;
  boleto_pdf_url: string | null;
  boleto_barcode: string | null;
  pix_qrcode_base64: string | null;
  pix_emv: string | null;
  pix_link: string | null;
  expires_at: string | null;
};

export type PortalCobrancaDetailResponse = {
  charge: ChargeRow & Record<string, unknown>;
  payment: PortalChargePayment | null;
};

export type PortalListQuery = {
  /** 1–200, default no servidor (50) */
  limit?: number;
  /** Cursor opaco devolvido em `next_cursor` da página anterior */
  cursor?: string | null;
};

export type CobrancasListResponse = {
  data: ChargeRow[];
  count: number;
  page_limit?: number;
  next_cursor?: string | null;
  billing_link_status?: string;
  message?: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readSessionHeaders(): HeadersInit {
  const token = localStorage.getItem(STORAGE_ACCESS_TOKEN);
  const tenantId = localStorage.getItem(STORAGE_TENANT_ID);
  const headers: Record<string, string> = {
    Accept: "application/json"
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
  }
  return headers;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = apiUrl(path);
  const headers = new Headers(init.headers);
  const session = readSessionHeaders();
  for (const [k, v] of Object.entries(session)) {
    if (!headers.has(k)) {
      headers.set(k, v);
    }
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    clearSession();
    window.dispatchEvent(new Event("portal:unauthorized"));
  }
  return res;
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_ACCESS_TOKEN);
  localStorage.removeItem(STORAGE_TENANT_ID);
  localStorage.removeItem(STORAGE_EMAIL);
}

export function saveSession(token: string, tenantId: string, email: string): void {
  localStorage.setItem(STORAGE_ACCESS_TOKEN, token);
  localStorage.setItem(STORAGE_TENANT_ID, tenantId);
  localStorage.setItem(STORAGE_EMAIL, email);
}

export function hasSession(): boolean {
  return Boolean(localStorage.getItem(STORAGE_ACCESS_TOKEN) && localStorage.getItem(STORAGE_TENANT_ID));
}

export async function portalLogin(body: { email: string; tenant_id: string; password: string }): Promise<PortalLoginResponse> {
  const res = await fetch(apiUrl("/v1/portal/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    let msg: string;
    if (
      typeof json === "object" &&
      json !== null &&
      "message" in json &&
      typeof (json as { message: unknown }).message === "string"
    ) {
      msg = (json as { message: string }).message;
    } else if (typeof json === "string" && json.trim()) {
      msg = json.trim();
    } else if (typeof json === "number" || typeof json === "boolean") {
      msg = `Resposta invalida da API (${String(json)}). Verifique se /v1/portal/auth/login existe neste servidor (HTTP ${res.status}).`;
    } else {
      const raw = text.trim();
      msg = raw.length > 0 ? `${raw} (HTTP ${res.status})` : `HTTP ${res.status}`;
    }
    throw new ApiError(msg, res.status, json);
  }
  const parsed = json as Partial<PortalLoginResponse>;
  if (!parsed.access_token || typeof parsed.access_token !== "string") {
    throw new ApiError("Resposta sem access_token", res.status, json);
  }
  return {
    access_token: parsed.access_token,
    token_type: typeof parsed.token_type === "string" ? parsed.token_type : "Bearer",
    expires_in: typeof parsed.expires_in === "number" ? parsed.expires_in : 900
  };
}

export type PortalMeResponse = {
  user: {
    id: string;
    email: string | null;
    full_name: string | null;
    membership_role: string;
    jwt_roles: string[];
  };
  tenant: { id: string; slug: string | null };
};

export async function fetchPortalMe(): Promise<PortalMeResponse> {
  const res = await apiFetch("/v1/portal/auth/me", { method: "GET" });
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
  return json as PortalMeResponse;
}

export type NotaFiscalResumo = {
  /** Presente após migração API `012` na view de resumo */
  id?: string | null;
  referencia_externa?: string | null;
  nome_tomador?: string | null;
  cpf_cnpj_tomador?: string | null;
  valor_servicos?: string | null;
  status_emissao?: string | null;
  numero_nfse?: string | null;
  data_emissao?: string | null;
  data_competencia?: string | null;
  descricao_servico?: string | null;
  [key: string]: unknown;
};

export type NotasFiscaisResponse = {
  data: NotaFiscalResumo[];
  count: number;
  page_limit?: number;
  next_cursor?: string | null;
};

function portalListSearch(q?: PortalListQuery): string {
  if (!q?.limit && !q?.cursor) {
    return "";
  }
  const sp = new URLSearchParams();
  if (q.limit != null) {
    sp.set("limit", String(q.limit));
  }
  if (q.cursor) {
    sp.set("cursor", q.cursor);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function fetchNotasFiscais(q?: PortalListQuery): Promise<NotasFiscaisResponse> {
  const res = await apiFetch(`/v1/portal/notas-fiscais${portalListSearch(q)}`, { method: "GET" });
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
  const o = json as Partial<NotasFiscaisResponse>;
  if (!Array.isArray(o.data)) {
    throw new ApiError("Formato inesperado: data nao e array", res.status, json);
  }
  return {
    data: o.data as NotaFiscalResumo[],
    count: typeof o.count === "number" ? o.count : o.data.length,
    page_limit: typeof o.page_limit === "number" ? o.page_limit : undefined,
    next_cursor: o.next_cursor === undefined ? undefined : (o.next_cursor as string | null)
  };
}

export type ClienteRow = {
  id: string;
  tenant_id: string;
  documento: string;
  nome: string;
  email: string | null;
  whatsapp_opt_in: boolean;
  created_at: string;
  updated_at: string;
};

export type ClientesListResponse = {
  data: ClienteRow[];
  count: number;
  page_limit?: number;
  next_cursor?: string | null;
};

export async function fetchClientes(q?: PortalListQuery): Promise<ClientesListResponse> {
  const res = await apiFetch(`/v1/portal/clientes${portalListSearch(q)}`, { method: "GET" });
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
  const o = json as Partial<ClientesListResponse>;
  if (!Array.isArray(o.data)) {
    throw new ApiError("Formato inesperado: data nao e array", res.status, json);
  }
  return {
    data: o.data as ClienteRow[],
    count: typeof o.count === "number" ? o.count : o.data.length,
    page_limit: typeof o.page_limit === "number" ? o.page_limit : undefined,
    next_cursor: o.next_cursor === undefined ? undefined : (o.next_cursor as string | null)
  };
}

export type CreateClienteBody = {
  documento: string;
  nome: string;
  email?: string | null;
  whatsapp_opt_in: boolean;
};

export async function postCliente(body: CreateClienteBody): Promise<{ cliente: ClienteRow }> {
  const res = await apiFetch("/v1/portal/clientes", {
    method: "POST",
    body: JSON.stringify({
      documento: body.documento,
      nome: body.nome,
      email: body.email ?? null,
      whatsapp_opt_in: body.whatsapp_opt_in
    })
  });
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
  const o = json as { cliente?: ClienteRow };
  if (!o.cliente) {
    throw new ApiError("Resposta sem cliente", res.status, json);
  }
  return { cliente: o.cliente };
}

export type ClienteCobrancasResponse = CobrancasListResponse & {
  cliente?: { id: string; nome: string; documento: string };
};

export async function fetchClienteCobrancas(clienteId: string, q?: PortalListQuery): Promise<ClienteCobrancasResponse> {
  const path = `/v1/portal/clientes/${encodeURIComponent(clienteId)}/cobrancas${portalListSearch(q)}`;
  const res = await apiFetch(path, { method: "GET" });
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
  const o = json as Partial<ClienteCobrancasResponse>;
  if (!Array.isArray(o.data)) {
    throw new ApiError("Formato inesperado: data nao e array", res.status, json);
  }
  return {
    data: o.data as ChargeRow[],
    count: typeof o.count === "number" ? o.count : o.data.length,
    page_limit: typeof o.page_limit === "number" ? o.page_limit : undefined,
    next_cursor: o.next_cursor === undefined ? undefined : (o.next_cursor as string | null),
    billing_link_status: typeof o.billing_link_status === "string" ? o.billing_link_status : undefined,
    message: typeof o.message === "string" ? o.message : undefined,
    cliente: o.cliente
  };
}

export type CreatePortalCobrancaBody = {
  reference: string;
  idempotency_key: string;
  amount: number;
  due_date: string;
  portal_cliente_id?: string;
};

export type CreatePortalCobrancaResponse = {
  charge: ChargeRow & Record<string, unknown>;
  idempotent: boolean;
};

export async function postPortalCobranca(body: CreatePortalCobrancaBody): Promise<CreatePortalCobrancaResponse> {
  const payload: Record<string, unknown> = {
    reference: body.reference,
    idempotency_key: body.idempotency_key,
    amount: body.amount,
    due_date: body.due_date
  };
  if (body.portal_cliente_id) {
    payload.portal_cliente_id = body.portal_cliente_id;
  }
  const res = await apiFetch("/v1/portal/cobrancas", {
    method: "POST",
    body: JSON.stringify(payload)
  });
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
  const o = json as Partial<CreatePortalCobrancaResponse>;
  if (!o.charge || typeof o.idempotent !== "boolean") {
    throw new ApiError("Resposta sem charge ou idempotent", res.status, json);
  }
  return { charge: o.charge as CreatePortalCobrancaResponse["charge"], idempotent: o.idempotent };
}

export type PatchPortalClienteBody = {
  nome?: string;
  email?: string | null;
  whatsapp_opt_in?: boolean;
};

export async function patchPortalCliente(
  clienteId: string,
  body: PatchPortalClienteBody
): Promise<{ cliente: ClienteRow }> {
  const payload: Record<string, unknown> = {};
  if (body.nome !== undefined) {
    payload.nome = body.nome;
  }
  if (body.email !== undefined) {
    payload.email = body.email;
  }
  if (body.whatsapp_opt_in !== undefined) {
    payload.whatsapp_opt_in = body.whatsapp_opt_in;
  }
  const res = await apiFetch(`/v1/portal/clientes/${encodeURIComponent(clienteId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
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
  const o = json as { cliente?: ClienteRow };
  if (!o.cliente) {
    throw new ApiError("Resposta sem cliente", res.status, json);
  }
  return { cliente: o.cliente };
}

export type PatchPortalCobrancaBody = {
  amount?: number;
  due_date?: string;
  metadata?: Record<string, unknown>;
};

export async function fetchPortalCobrancaDetail(chargeId: string): Promise<PortalCobrancaDetailResponse> {
  const res = await apiFetch(`/v1/portal/cobrancas/${encodeURIComponent(chargeId)}`, { method: "GET" });
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
  const o = json as Partial<PortalCobrancaDetailResponse>;
  if (!o.charge || typeof o.charge !== "object") {
    throw new ApiError("Resposta sem charge", res.status, json);
  }
  return {
    charge: o.charge as ChargeRow & Record<string, unknown>,
    payment: o.payment === null || o.payment === undefined ? null : (o.payment as PortalChargePayment)
  };
}

export async function patchPortalCobranca(
  chargeId: string,
  body: PatchPortalCobrancaBody
): Promise<{ charge: ChargeRow & Record<string, unknown> }> {
  const payload: Record<string, unknown> = {};
  if (body.amount !== undefined) {
    payload.amount = body.amount;
  }
  if (body.due_date !== undefined) {
    payload.due_date = body.due_date;
  }
  if (body.metadata !== undefined) {
    payload.metadata = body.metadata;
  }
  const res = await apiFetch(`/v1/portal/cobrancas/${encodeURIComponent(chargeId)}`, {
    method: "PATCH",
    body: JSON.stringify(payload)
  });
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
  const o = json as { charge?: ChargeRow };
  if (!o.charge) {
    throw new ApiError("Resposta sem charge", res.status, json);
  }
  return { charge: o.charge as ChargeRow & Record<string, unknown> };
}

export type EscritorioDashboardResponse = {
  periodo: { inicio: string; fim: string };
  cobrancas: {
    total: number;
    por_status: Record<string, number>;
    valor_total_emitido: number;
    valor_total_recebido: number;
    valor_total_vencido: number;
    taxa_conversao: number;
  };
  notificacoes: {
    total_enviadas: number;
    total_falhas: number;
    por_canal: { email: number; whatsapp: number };
  };
  top_clientes_inadimplentes: Array<{
    nome: string;
    documento_mascarado: string;
    valor_vencido: number;
    qtd_cobr_vencidas: number;
  }>;
};

export type EscritorioAssinaturaResponse = {
  assinatura: {
    id: string;
    status: string;
    read_only: boolean;
    trial_ends_at: string | null;
    current_period_start: string | null;
    current_period_end: string | null;
    plano: {
      id: string;
      slug: string;
      nome: string;
      max_clientes: number;
      max_cobrancas_mes: number;
      preco_mensal: number;
    };
    uso: {
      year_month: string;
      clientes: number;
      cobrancas_criadas_mes: number;
    };
  };
};

export async function fetchEscritorioAssinatura(): Promise<EscritorioAssinaturaResponse> {
  const res = await apiFetch("/v1/portal/escritorio/assinatura", { method: "GET" });
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
  return json as EscritorioAssinaturaResponse;
}

export async function fetchEscritorioDashboard(periodo = "30d"): Promise<EscritorioDashboardResponse> {
  const sp = new URLSearchParams({ periodo });
  const res = await apiFetch(`/v1/portal/escritorio/dashboard?${sp}`, { method: "GET" });
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
  return json as EscritorioDashboardResponse;
}

export async function downloadEscritorioCobrancasCsv(): Promise<Blob> {
  const res = await apiFetch("/v1/portal/escritorio/cobrancas/export?format=csv", { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    let json: unknown = text;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      /* texto puro */
    }
    const msg =
      typeof json === "object" && json !== null && "message" in json && typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, json);
  }
  return res.blob();
}

export type ClientePortalCobrancaRow = {
  id: string;
  canonical_status: string;
  amount: string;
  due_date: string;
  description: string | null;
  type: string | null;
  payment: PortalChargePayment | null;
};

export type ClientePortalCobrancasResponse = {
  data: ClientePortalCobrancaRow[];
  page: number;
  limit: number;
};

export function parseJwtPayload(token: string): { sub?: string; tid?: string; roles?: string[] } {
  const parts = token.split(".");
  if (parts.length < 2) {
    return {};
  }
  try {
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as { sub?: string; tid?: string; roles?: string[] };
  } catch {
    return {};
  }
}

export function saveClienteSession(token: string, automacaoTenantId: string): void {
  localStorage.setItem(STORAGE_CLIENTE_TOKEN, token);
  localStorage.setItem(STORAGE_CLIENTE_TENANT_ID, automacaoTenantId);
}

export function clearClienteSession(): void {
  localStorage.removeItem(STORAGE_CLIENTE_TOKEN);
  localStorage.removeItem(STORAGE_CLIENTE_TENANT_ID);
}

export function hasClienteSession(): boolean {
  return Boolean(localStorage.getItem(STORAGE_CLIENTE_TOKEN) && localStorage.getItem(STORAGE_CLIENTE_TENANT_ID));
}

function readClienteSessionHeaders(): HeadersInit {
  const token = localStorage.getItem(STORAGE_CLIENTE_TOKEN);
  const tenantId = localStorage.getItem(STORAGE_CLIENTE_TENANT_ID);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (tenantId) {
    headers["x-tenant-id"] = tenantId;
  }
  return headers;
}

export async function clienteApiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const url = apiUrl(path);
  const headers = new Headers(init.headers);
  const session = readClienteSessionHeaders();
  for (const [k, v] of Object.entries(session)) {
    if (!headers.has(k)) {
      headers.set(k, v);
    }
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    clearClienteSession();
    window.dispatchEvent(new Event("portal-cliente:unauthorized"));
  }
  return res;
}

export async function postClienteRequestAccess(email: string, tenantSlug: string): Promise<{ message: string }> {
  const res = await fetch(apiUrl("/v1/portal/cliente/auth/request-access"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, tenant_slug: tenantSlug })
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida", res.status, text);
  }
  if (!res.ok) {
    throw new ApiError("Falha ao solicitar acesso", res.status, json);
  }
  return json as { message: string };
}

export async function postClienteVerifyToken(
  token: string,
  tenantSlug: string
): Promise<{ token: string; token_type: string; expires_in: number }> {
  const res = await fetch(apiUrl("/v1/portal/cliente/auth/verify-token"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ token, tenant_slug: tenantSlug })
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida", res.status, text);
  }
  if (!res.ok) {
    const msg =
      typeof json === "object" && json !== null && "message" in json && typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : "Link invalido ou expirado";
    throw new ApiError(msg, res.status, json);
  }
  const o = json as { token?: string };
  if (!o.token) {
    throw new ApiError("Resposta sem token", res.status, json);
  }
  return json as { token: string; token_type: string; expires_in: number };
}

export async function fetchClientePortalCobrancas(status?: string): Promise<ClientePortalCobrancasResponse> {
  const sp = new URLSearchParams();
  if (status) {
    sp.set("status", status);
  }
  const q = sp.toString();
  const res = await clienteApiFetch(`/v1/portal/cliente/cobrancas${q ? `?${q}` : ""}`, { method: "GET" });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida", res.status, text);
  }
  if (!res.ok) {
    throw new ApiError("Falha ao listar cobranças", res.status, json);
  }
  const o = json as Partial<ClientePortalCobrancasResponse>;
  if (!Array.isArray(o.data)) {
    throw new ApiError("Formato inesperado", res.status, json);
  }
  return {
    data: o.data as ClientePortalCobrancaRow[],
    page: typeof o.page === "number" ? o.page : 1,
    limit: typeof o.limit === "number" ? o.limit : 20
  };
}

export async function fetchClientePortalCobrancaDetail(chargeId: string): Promise<ClientePortalCobrancaRow & { events: Array<{ event_type: string; old_status: string | null; new_status: string | null; created_at: string }> }> {
  const res = await clienteApiFetch(`/v1/portal/cliente/cobrancas/${encodeURIComponent(chargeId)}`, { method: "GET" });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida", res.status, text);
  }
  if (!res.ok) {
    throw new ApiError("Cobrança não encontrada", res.status, json);
  }
  return json as ClientePortalCobrancaRow & {
    events: Array<{ event_type: string; old_status: string | null; new_status: string | null; created_at: string }>;
  };
}

export async function fetchCobrancas(q?: PortalListQuery): Promise<CobrancasListResponse> {
  const res = await apiFetch(`/v1/portal/cobrancas${portalListSearch(q)}`, { method: "GET" });
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
  const o = json as Partial<CobrancasListResponse>;
  if (!Array.isArray(o.data)) {
    throw new ApiError("Formato inesperado: data nao e array", res.status, json);
  }
  return {
    data: o.data as ChargeRow[],
    count: typeof o.count === "number" ? o.count : o.data.length,
    page_limit: typeof o.page_limit === "number" ? o.page_limit : undefined,
    next_cursor: o.next_cursor === undefined ? undefined : (o.next_cursor as string | null),
    billing_link_status: typeof o.billing_link_status === "string" ? o.billing_link_status : undefined,
    message: typeof o.message === "string" ? o.message : undefined
  };
}
