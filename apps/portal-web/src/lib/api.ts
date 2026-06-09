import {
  STORAGE_ACCESS_TOKEN,
  STORAGE_CLIENTE_TENANT_ID,
  STORAGE_CLIENTE_TOKEN,
  STORAGE_EMAIL,
  STORAGE_TENANT_ID
} from "./storageKeys";

/** Base sem barra final. Vazio = URLs relativas `/v1/...` (proxy Vite em dev -> :3333). */
export function getApiBase(): string {
  const raw = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!raw) {
    return "";
  }
  const base = raw.replace(/\/$/, "");
  if (import.meta.env.DEV && /localhost:3334\b/i.test(base)) {
        // eslint-disable-next-line no-console
        console.warn(
          "[portal] VITE_API_BASE_URL aponta para :3334 — requer `npm run dev` na raiz com PORT=3334. " +
            "Com Docker (`npm run dev:up`), deixe VITE_API_BASE_URL vazio (proxy :3333)."
        );
  }
  return base;
}

/** Mensagem acionavel quando fetch falha por rede (API parada ou porta errada). */
export function formatPortalNetworkError(url: string, cause: unknown): ApiError {
  const base = getApiBase();
  const target = base || "(proxy Vite /v1 -> http://localhost:3333)";
  const hint =
    base.includes(":3334")
      ? "Inicie a API no host: `$env:PORT=\"3334\"; npm run dev` ou troque .env.local para o modo Docker (veja .env.local.docker.example)."
      : "Suba a API: `npm run dev:up` (Docker :3333) e reinicie `npm run portal:dev` apos alterar .env.local.";
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new ApiError(
    `Nao foi possivel contactar a API (${target}). ${hint} Detalhe: ${detail}`,
    0,
    { url, cause: detail }
  );
}

function isNetworkFetchFailure(error: unknown): boolean {
  if (!(error instanceof TypeError)) {
    return false;
  }
  const msg = error.message.toLowerCase();
  return msg.includes("fetch") || msg.includes("network") || msg.includes("failed");
}

async function portalFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (isNetworkFetchFailure(error)) {
      throw formatPortalNetworkError(url, error);
    }
    throw error;
  }
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
  login_kind?: "portal" | "platform_master" | "tenant_selection_required";
  tenant_id?: string;
  tenant_slug?: string | null;
  user?: { id: string; email: string; full_name: string | null };
  tenants?: Array<{
    automacao_tenant_id: string;
    slug: string | null;
    name: string | null;
    role: string;
  }>;
};

export type UnifiedLoginTenantOption = {
  automacao_tenant_id: string;
  slug: string | null;
  name: string | null;
  role: string;
};

export type UnifiedLoginResult =
  | {
      kind: "portal";
      access_token: string;
      token_type: string;
      expires_in: number;
      tenant_id: string;
      tenant_slug: string | null;
    }
  | {
      kind: "platform_master";
      access_token: string;
      token_type: string;
      expires_in: number;
      user: { id: string; email: string; full_name: string | null };
    }
  | {
      kind: "tenant_selection_required";
      tenants: UnifiedLoginTenantOption[];
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

export type PortalChargeEvent = {
  event_type: string;
  old_status: string | null;
  new_status: string | null;
  created_at: string;
  payload_json?: Record<string, unknown> | null;
};

export type PortalCobrancaDetailResponse = {
  charge: ChargeRow & Record<string, unknown>;
  payment: PortalChargePayment | null;
  events: PortalChargeEvent[];
};

export type PortalListQuery = {
  /** 1–200, default no servidor (50) */
  limit?: number;
  /** Cursor opaco devolvido em `next_cursor` da página anterior */
  cursor?: string | null;
  /** Busca textual (clientes: nome ou documento) */
  search?: string;
};

/** Query GET /v1/portal/fiscal/guias */
export type GuiasFiscaisListQuery = PortalListQuery & {
  tipo_guia?: "DAS" | "DARF";
  competencia?: string;
  status?: string;
  portal_cliente_id?: string;
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

export type ApiValidationIssue = { path: string; message: string };

/** Lançado quando o backend retorna 422 com array de `issues` por campo. */
export class PortalValidationError extends Error {
  constructor(
    readonly issues: ApiValidationIssue[],
    readonly status: number,
    readonly body: unknown
  ) {
    super(issues[0]?.message ?? "Dados inválidos");
    this.name = "PortalValidationError";
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
  if (init.body && !headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await portalFetch(url, { ...init, headers });
  if (res.status === 403) {
    try {
      const clone = res.clone();
      const json = (await clone.json()) as { error?: string };
      if (json.error === "tenant_inactive") {
        clearSession();
        window.dispatchEvent(new CustomEvent("portal:tenant-inactive"));
      }
    } catch {
      /* ignore parse errors */
    }
  }
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

export async function portalLogin(body: {
  email: string;
  password: string;
  tenant_id?: string;
}): Promise<UnifiedLoginResult> {
  const payload: Record<string, string> = {
    email: body.email,
    password: body.password
  };
  if (body.tenant_id?.trim()) {
    payload.tenant_id = body.tenant_id.trim();
  }

  const res = await portalFetch(apiUrl("/v1/portal/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
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

  const o = json as PortalLoginResponse;
  const kind = o.login_kind ?? (o.access_token ? "portal" : undefined);

  if (kind === "tenant_selection_required" && o.tenants) {
    return { kind: "tenant_selection_required", tenants: o.tenants };
  }

  if (kind === "platform_master" && o.access_token && o.user) {
    return {
      kind: "platform_master",
      access_token: o.access_token,
      token_type: o.token_type ?? "Bearer",
      expires_in: o.expires_in ?? 28800,
      user: o.user
    };
  }

  if (o.access_token && typeof o.access_token === "string") {
    const tenantId = o.tenant_id ?? "";
    if (!tenantId) {
      throw new ApiError("Resposta portal sem tenant_id", res.status, json);
    }
    return {
      kind: "portal",
      access_token: o.access_token,
      token_type: o.token_type ?? "Bearer",
      expires_in: o.expires_in ?? 900,
      tenant_id: tenantId,
      tenant_slug: o.tenant_slug ?? null
    };
  }

  throw new ApiError("Resposta de login inesperada", res.status, json);
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
  modules?: import("./portal-nav-access").PortalModuleFlags;
  module_labels?: Record<string, string>;
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
  if (!q?.limit && !q?.cursor && !q?.search?.trim()) {
    return "";
  }
  const sp = new URLSearchParams();
  if (q.limit != null) {
    sp.set("limit", String(q.limit));
  }
  if (q.cursor) {
    sp.set("cursor", q.cursor);
  }
  if (q.search?.trim()) {
    sp.set("search", q.search.trim());
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function guiasFiscaisListSearch(q?: GuiasFiscaisListQuery): string {
  const sp = new URLSearchParams();
  if (q?.limit != null) {
    sp.set("limit", String(q.limit));
  }
  if (q?.cursor) {
    sp.set("cursor", q.cursor);
  }
  if (q?.tipo_guia) {
    sp.set("tipo_guia", q.tipo_guia);
  }
  if (q?.competencia?.trim()) {
    sp.set("competencia", q.competencia.trim());
  }
  if (q?.status?.trim()) {
    sp.set("status", q.status.trim());
  }
  if (q?.portal_cliente_id?.trim()) {
    sp.set("portal_cliente_id", q.portal_cliente_id.trim());
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

export type ClienteEnderecoRow = {
  cep: string;
  logradouro: string;
  numero: string | null;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
};

export type ClienteRow = {
  id: string;
  tenant_id: string;
  documento: string;
  nome: string;
  email: string | null;
  telefone?: string | null;
  whatsapp_opt_in: boolean;
  created_at: string;
  updated_at: string;
  endereco?: ClienteEnderecoRow | null;
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

export async function fetchClienteById(clienteId: string): Promise<ClienteRow | null> {
  const res = await apiFetch(`/v1/portal/clientes/${encodeURIComponent(clienteId)}`, { method: "GET" });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const msg =
      typeof json === "object" && json !== null && "message" in json && typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, json);
  }
  const o = json as { cliente?: ClienteRow };
  return o.cliente ?? null;
}

export type ClienteEnderecoBody = {
  cep: string;
  logradouro: string;
  numero?: string | null;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
};

export type CreateClienteBody = {
  documento: string;
  nome: string;
  email: string;
  telefone?: string | null;
  whatsapp_opt_in: boolean;
  endereco?: ClienteEnderecoBody | null;
};

export async function postCliente(body: CreateClienteBody): Promise<{ cliente: ClienteRow }> {
  const payload: Record<string, unknown> = {
    documento: body.documento,
    nome: body.nome,
    email: body.email,
    telefone: body.telefone ?? null,
    whatsapp_opt_in: body.whatsapp_opt_in
  };
  if (body.endereco !== undefined) {
    payload.endereco = body.endereco;
  }
  const res = await apiFetch("/v1/portal/clientes", {
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
    const j = json as Record<string, unknown> | null;
    if (
      j &&
      Array.isArray(j.issues) &&
      j.issues.length > 0 &&
      typeof (j.issues[0] as Record<string, unknown>).message === "string"
    ) {
      throw new PortalValidationError(j.issues as ApiValidationIssue[], res.status, json);
    }
    const msg =
      j && typeof j.message === "string" ? j.message : `Erro ${res.status} ao cadastrar cliente`;
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
    const j = json as Record<string, unknown> | null;
    if (
      j &&
      Array.isArray(j.issues) &&
      j.issues.length > 0 &&
      typeof (j.issues[0] as Record<string, unknown>).message === "string"
    ) {
      throw new PortalValidationError(j.issues as ApiValidationIssue[], res.status, json);
    }
    const msg =
      j && typeof j.message === "string" ? j.message : `Erro ${res.status} ao criar cobrança`;
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
  email?: string;
  telefone?: string | null;
  whatsapp_opt_in?: boolean;
  endereco?: ClienteEnderecoBody | null;
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
  if (body.telefone !== undefined) {
    payload.telefone = body.telefone;
  }
  if (body.whatsapp_opt_in !== undefined) {
    payload.whatsapp_opt_in = body.whatsapp_opt_in;
  }
  if (body.endereco !== undefined) {
    payload.endereco = body.endereco;
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
    const j = json as Record<string, unknown> | null;
    if (
      j &&
      Array.isArray(j.issues) &&
      j.issues.length > 0 &&
      typeof (j.issues[0] as Record<string, unknown>).message === "string"
    ) {
      throw new PortalValidationError(j.issues as ApiValidationIssue[], res.status, json);
    }
    const msg =
      j && typeof j.message === "string" ? j.message : `Erro ${res.status} ao atualizar cliente`;
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

export async function fetchPortalChargeBoletoPdfBlob(pdfPath: string): Promise<Blob> {
  const path = pdfPath.startsWith("/") ? pdfPath : `/${pdfPath}`;
  const res = await apiFetch(path, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    let json: unknown = text;
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      /* keep text */
    }
    throw new ApiError("Nao foi possivel obter o PDF do boleto.", res.status, json);
  }
  return res.blob();
}

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
  const rawEvents = (json as { events?: unknown }).events;
  const events = Array.isArray(rawEvents)
    ? (rawEvents as PortalChargeEvent[])
    : [];

  return {
    charge: o.charge as ChargeRow & Record<string, unknown>,
    payment: o.payment === null || o.payment === undefined ? null : (o.payment as PortalChargePayment),
    events
  };
}

export async function reprocessPortalCobrancaEmission(
  chargeId: string
): Promise<{ charge: ChargeRow & Record<string, unknown>; job_scheduled: boolean }> {
  const res = await apiFetch(
    `/v1/portal/cobrancas/${encodeURIComponent(chargeId)}/reprocess-emission`,
    { method: "POST" }
  );
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    const j = json as Record<string, unknown> | null;
    if (
      j &&
      Array.isArray(j.issues) &&
      j.issues.length > 0 &&
      typeof (j.issues[0] as Record<string, unknown>).message === "string"
    ) {
      throw new PortalValidationError(j.issues as ApiValidationIssue[], res.status, json);
    }
    const msg =
      j && typeof j.message === "string" ? j.message : `Erro ${res.status} ao reprocessar emissão`;
    throw new ApiError(msg, res.status, json);
  }
  const o = json as { charge?: ChargeRow; job_scheduled?: boolean };
  if (!o.charge) {
    throw new ApiError("Resposta sem charge", res.status, json);
  }
  return {
    charge: o.charge as ChargeRow & Record<string, unknown>,
    job_scheduled: o.job_scheduled === true
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

export type EscritorioConfig = {
  tenant_id: string;
  cnpj_emissor: string | null;
  razao_social: string | null;
  inscricao_municipal: string | null;
  regime_tributario: string | null;
  codigo_municipio: string | null;
  aliquota_iss: number | null;
  gateway_provider: string | null;
  gateway_api_key: string | null;
  gateway_credentials_configured?: boolean;
  whatsapp_provider: string | null;
  whatsapp_token: string | null;
};

export type GatewayProviderMeta = {
  id: string;
  label: string;
  enabled: boolean;
  authType: "api_key" | "mtls_oauth" | "oauth_basic";
  credentialFields: Array<{
    key: string;
    label: string;
    secret: boolean;
    required: boolean;
  }>;
  supportsBoleto: boolean;
  supportsPix: boolean;
};

export type PatchEscritorioConfigBody = {
  cnpj_emissor?: string;
  razao_social?: string;
  inscricao_municipal?: string;
  regime_tributario?: "simples" | "presumido" | "real";
  codigo_municipio?: string;
  aliquota_iss?: number;
  gateway_provider?: string;
  gateway_api_key?: string;
  gateway_credentials?: Record<string, string>;
  whatsapp_provider?: "zapi" | "twilio";
  whatsapp_token?: string;
};

export type PatchGatewayProviderBody = {
  gateway_provider: string;
  gateway_api_key?: string;
  gateway_credentials?: Record<string, string>;
  certificate_upload_id?: string;
};

export type CertificateValidateResponse = {
  certificate_id: string;
  subject_cn: string;
  not_after: string;
  days_remaining: number;
  warnings: string[];
  info: string[];
};

export async function validateCertificateUpload(
  certificate: File,
  privateKey: File
): Promise<CertificateValidateResponse> {
  const form = new FormData();
  form.append("certificate", certificate);
  form.append("private_key", privateKey);
  const res = await apiFetch("/v1/portal/certificates/validate", {
    method: "POST",
    body: form
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    const payload = json as { message?: string; error_code?: string };
    const message =
      payload.message ??
      (payload.error_code === "NET-001"
        ? "Não foi possível validar o certificado. Verifique sua conexão e tente novamente."
        : apiMessageFromJson(json, res.status));
    throw new ApiError(message, res.status, json);
  }
  return json as CertificateValidateResponse;
}

export type GatewayChangeLogEntry = {
  id: string;
  old_provider: string | null;
  new_provider: string;
  changed_at: string;
  changed_by_user_id: string | null;
};

export type ChargingRuleRow = {
  id: string;
  days_offset: number;
  channel: string;
  is_active: boolean;
  event_type?: string | null;
  body_preview?: string | null;
};

export type NotificationTemplateRow = {
  id: string;
  tenant_id: string | null;
  event_type: string;
  channel: string;
  subject: string | null;
  body_template: string;
  is_active: boolean;
  updated_at?: string;
};

export type TemplatePreviewResponse = {
  subject: string | null;
  body_rendered: string;
};

function apiMessageFromJson(json: unknown, status: number): string {
  if (typeof json === "object" && json !== null && "message" in json && typeof (json as { message: unknown }).message === "string") {
    return (json as { message: string }).message;
  }
  return `HTTP ${status}`;
}

export async function fetchEscritorioConfig(): Promise<{ config: EscritorioConfig | null }> {
  const res = await apiFetch("/v1/portal/escritorio/config", { method: "GET" });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  return json as { config: EscritorioConfig | null };
}

export async function fetchGatewayProviders(): Promise<{ data: GatewayProviderMeta[] }> {
  const res = await apiFetch("/v1/portal/escritorio/gateway/providers", { method: "GET" });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  const o = json as { data?: GatewayProviderMeta[] };
  return { data: Array.isArray(o.data) ? o.data : [] };
}

export async function fetchGatewayProviderSchema(
  provider: string
): Promise<{ provider: GatewayProviderMeta }> {
  const res = await apiFetch(
    `/v1/portal/escritorio/gateway/providers/${encodeURIComponent(provider)}/schema`,
    { method: "GET" }
  );
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  return json as { provider: GatewayProviderMeta };
}

export async function patchGatewayProvider(
  body: PatchGatewayProviderBody
): Promise<{ config: EscritorioConfig | null }> {
  const res = await apiFetch("/v1/portal/escritorio/gateway", {
    method: "PATCH",
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
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  return json as { config: EscritorioConfig | null };
}

export async function fetchGatewayChangeHistory(): Promise<{ data: GatewayChangeLogEntry[] }> {
  const res = await apiFetch("/v1/portal/escritorio/gateway/history?limit=10", { method: "GET" });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  const o = json as { data?: GatewayChangeLogEntry[] };
  return { data: Array.isArray(o.data) ? o.data : [] };
}

export async function patchEscritorioConfig(body: PatchEscritorioConfigBody): Promise<{ config: EscritorioConfig | null }> {
  const res = await apiFetch("/v1/portal/escritorio/config", {
    method: "PATCH",
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
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  return json as { config: EscritorioConfig | null };
}

export async function fetchChargingRules(): Promise<{ data: ChargingRuleRow[] }> {
  const res = await apiFetch("/v1/portal/escritorio/regua", { method: "GET" });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  const o = json as { data?: ChargingRuleRow[] };
  return { data: Array.isArray(o.data) ? o.data : [] };
}

export async function postChargingRule(body: {
  days_offset: number;
  channel: "email" | "whatsapp" | "both";
  template_id?: string;
}): Promise<{ rule: ChargingRuleRow }> {
  const res = await apiFetch("/v1/portal/escritorio/regua", {
    method: "POST",
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
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  return json as { rule: ChargingRuleRow };
}

export async function patchChargingRule(
  ruleId: string,
  body: { is_active?: boolean; channel?: "email" | "whatsapp" | "both" }
): Promise<{ rule: ChargingRuleRow }> {
  const res = await apiFetch(`/v1/portal/escritorio/regua/${encodeURIComponent(ruleId)}`, {
    method: "PATCH",
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
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  return json as { rule: ChargingRuleRow };
}

export async function deleteChargingRule(ruleId: string): Promise<void> {
  const res = await apiFetch(`/v1/portal/escritorio/regua/${encodeURIComponent(ruleId)}`, { method: "DELETE" });
  if (res.status === 204) {
    return;
  }
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
}

export async function fetchNotificationTemplates(): Promise<{ data: NotificationTemplateRow[] }> {
  const res = await apiFetch("/v1/portal/escritorio/templates", { method: "GET" });
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  const o = json as { data?: NotificationTemplateRow[] };
  return { data: Array.isArray(o.data) ? o.data : [] };
}

export async function patchNotificationTemplate(
  templateId: string,
  body: { subject?: string; body_template: string }
): Promise<{ template: NotificationTemplateRow }> {
  const res = await apiFetch(`/v1/portal/escritorio/templates/${encodeURIComponent(templateId)}`, {
    method: "PATCH",
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
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  return json as { template: NotificationTemplateRow };
}

export async function previewNotificationTemplate(
  templateId: string,
  chargeId: string
): Promise<TemplatePreviewResponse> {
  const sp = new URLSearchParams({ charge_id: chargeId });
  const res = await apiFetch(
    `/v1/portal/escritorio/templates/${encodeURIComponent(templateId)}/preview?${sp}`,
    { method: "GET" }
  );
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError("Resposta invalida da API", res.status, text);
  }
  if (!res.ok) {
    throw new ApiError(apiMessageFromJson(json, res.status), res.status, json);
  }
  return json as TemplatePreviewResponse;
}

/** Nao reenvia segredo se vazio ou igual ao valor mascarado ja exibido. */
export function shouldPatchSecret(input: string, masked: string | null | undefined): boolean {
  const t = input.trim();
  if (!t) {
    return false;
  }
  if (masked && t === masked) {
    return false;
  }
  return true;
}

export type ActivateEscritorioAssinaturaResponse = {
  activation: {
    gatewayCustomerId: string;
    gatewaySubscriptionId: string;
    status: string;
    nextDueDate: string;
  };
};

export async function activateEscritorioAssinatura(): Promise<ActivateEscritorioAssinaturaResponse> {
  const res = await apiFetch("/v1/portal/escritorio/assinatura/activate", { method: "POST" });
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
  const o = json as Partial<ActivateEscritorioAssinaturaResponse>;
  if (!o.activation?.gatewaySubscriptionId) {
    throw new ApiError("Resposta sem activation", res.status, json);
  }
  return json as ActivateEscritorioAssinaturaResponse;
}

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

export type EscritorioCobrancasCsvExportParams = {
  from?: string;
  to?: string;
};

export async function downloadEscritorioCobrancasCsv(
  params?: EscritorioCobrancasCsvExportParams
): Promise<Blob> {
  const sp = new URLSearchParams({ format: "csv" });
  if (params?.from?.trim()) {
    sp.set("from", params.from.trim());
  }
  if (params?.to?.trim()) {
    sp.set("to", params.to.trim());
  }
  const res = await apiFetch(`/v1/portal/escritorio/cobrancas/export?${sp}`, { method: "GET" });
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
    const payloadPart = parts[1];
    if (!payloadPart) {
      return {};
    }
    const b64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
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

export type GuiaFiscalRow = {
  id: string;
  portal_cliente_id: string;
  tipo_guia: "DAS" | "DARF";
  competencia: string;
  data_vencimento: string | null;
  valor_principal: number;
  valor_multa: number;
  valor_juros: number;
  valor_total: number;
  linha_digitavel: string | null;
  pix_copia_cola: string | null;
  status: string;
  compliance_status: string;
  compliance_motivo: string | null;
  pdf_url: string | null;
  versao_atual: number;
  created_at: string;
  updated_at: string;
};

export type GuiasFiscaisListResponse = {
  guias: GuiaFiscalRow[];
  count: number;
  page_limit?: number;
  next_cursor?: string | null;
};

export async function fetchGuiasFiscais(q?: GuiasFiscaisListQuery): Promise<GuiasFiscaisListResponse> {
  const res = await apiFetch(`/v1/portal/fiscal/guias${guiasFiscaisListSearch(q)}`, { method: "GET" });
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
  const o = json as Partial<GuiasFiscaisListResponse>;
  if (!Array.isArray(o.guias)) {
    throw new ApiError("Formato inesperado: guias nao e array", res.status, json);
  }
  return {
    guias: o.guias as GuiaFiscalRow[],
    count: typeof o.count === "number" ? o.count : o.guias.length,
    page_limit: typeof o.page_limit === "number" ? o.page_limit : undefined,
    next_cursor: o.next_cursor === undefined ? undefined : (o.next_cursor as string | null)
  };
}

export async function fetchGuiaFiscal(guiaId: string): Promise<{ guia: GuiaFiscalRow }> {
  const res = await apiFetch(`/v1/portal/fiscal/guias/${encodeURIComponent(guiaId)}`, { method: "GET" });
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
  const o = json as { guia?: GuiaFiscalRow };
  if (!o.guia?.id) {
    throw new ApiError("Formato inesperado: guia ausente", res.status, json);
  }
  return { guia: o.guia };
}

export type CertificadoDigitalRow = {
  id: string;
  portal_cliente_id: string;
  label: string;
  valid_from: string;
  valid_until: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
};

export type PostCertificadoDigitalBody = {
  portal_cliente_id: string;
  label: string;
  valid_from: string;
  valid_until: string;
  certificado_pem: string;
  chave_privada_pem: string;
};

export async function fetchCertificadoDigital(
  portalClienteId: string
): Promise<{ certificado: CertificadoDigitalRow | null }> {
  const qs = new URLSearchParams({ portal_cliente_id: portalClienteId });
  const res = await apiFetch(`/v1/portal/fiscal/certificados?${qs.toString()}`, {
    method: "GET"
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
  const o = json as { certificado?: CertificadoDigitalRow | null };
  if (!("certificado" in o)) {
    throw new ApiError("Formato inesperado: certificado ausente", res.status, json);
  }
  return { certificado: o.certificado ?? null };
}

export async function postCertificadoDigital(
  body: PostCertificadoDigitalBody
): Promise<{ certificado: CertificadoDigitalRow }> {
  const res = await apiFetch("/v1/portal/fiscal/certificados", {
    method: "POST",
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
    const msg =
      typeof json === "object" && json !== null && "message" in json && typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, json);
  }
  const o = json as { certificado?: CertificadoDigitalRow };
  if (!o.certificado?.id) {
    throw new ApiError("Formato inesperado: certificado ausente", res.status, json);
  }
  return { certificado: o.certificado };
}

export type ProcuracaoRow = {
  id: string;
  portal_cliente_id: string;
  tipo: "ecac" | "receita_federal" | "outro";
  procurador_documento: string;
  validade_inicio: string;
  validade_fim: string;
  ativa: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PostProcuracaoBody = {
  portal_cliente_id: string;
  tipo?: "ecac" | "receita_federal" | "outro";
  procurador_documento: string;
  validade_inicio: string;
  validade_fim: string;
  ativa?: boolean;
};

export async function fetchProcuracao(
  portalClienteId: string
): Promise<{ procuracao: ProcuracaoRow | null }> {
  const qs = new URLSearchParams({ portal_cliente_id: portalClienteId });
  const res = await apiFetch(`/v1/portal/fiscal/procuracoes?${qs.toString()}`, {
    method: "GET"
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
  const o = json as { procuracao?: ProcuracaoRow | null };
  if (!("procuracao" in o)) {
    throw new ApiError("Formato inesperado: procuracao ausente", res.status, json);
  }
  return { procuracao: o.procuracao ?? null };
}

export async function postProcuracao(body: PostProcuracaoBody): Promise<{ procuracao: ProcuracaoRow }> {
  const res = await apiFetch("/v1/portal/fiscal/procuracoes", {
    method: "POST",
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
    const msg =
      typeof json === "object" && json !== null && "message" in json && typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, json);
  }
  const o = json as { procuracao?: ProcuracaoRow };
  if (!o.procuracao?.id) {
    throw new ApiError("Formato inesperado: procuracao ausente", res.status, json);
  }
  return { procuracao: o.procuracao };
}

export async function fetchGuiaFiscalPdfUrl(
  guiaId: string
): Promise<{ pdf_url: string; expires_in_seconds: number }> {
  const res = await apiFetch(`/v1/portal/fiscal/guias/${encodeURIComponent(guiaId)}/pdf-url`, {
    method: "GET"
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
  const o = json as { pdf_url?: string; expires_in_seconds?: number };
  if (!o.pdf_url) {
    throw new ApiError("Formato inesperado: pdf_url ausente", res.status, json);
  }
  return {
    pdf_url: o.pdf_url,
    expires_in_seconds: typeof o.expires_in_seconds === "number" ? o.expires_in_seconds : 3600
  };
}

export type PostGuiaPagamentoBody = {
  valor_pago: number;
  data_pagamento: string;
  meio?: "pix" | "boleto" | "manual" | "conciliacao";
  comprovante_url?: string;
};

export async function postGuiaPagamento(
  guiaId: string,
  body: PostGuiaPagamentoBody
): Promise<{ pagamento: { id: string; valor_pago: number; data_pagamento: string }; guia_status: string }> {
  const res = await apiFetch(`/v1/portal/fiscal/guias/${encodeURIComponent(guiaId)}/pagamentos`, {
    method: "POST",
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
    const msg =
      typeof json === "object" && json !== null && "message" in json && typeof (json as { message: unknown }).message === "string"
        ? (json as { message: string }).message
        : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, json);
  }
  const o = json as { pagamento?: { id: string; valor_pago: number; data_pagamento: string }; guia_status?: string };
  if (!o.pagamento?.id) {
    throw new ApiError("Formato inesperado: pagamento ausente", res.status, json);
  }
  return { pagamento: o.pagamento, guia_status: o.guia_status ?? "PAGO" };
}

export type FiscalIngestValidationError = {
  linha: number;
  campo: string;
  codigo: string;
  mensagem: string;
};

export type FiscalIngestCanonicalPreview = {
  cnpj: string;
  competencia: string;
  receita_bruta_mes: number;
  valor_total_das: number;
  portal_cliente_id: string | null;
};

export type FiscalIngestPublic = {
  id: string;
  status: "VALIDANDO" | "VALIDADO" | "ERRO";
  source_type: string;
  original_filename: string | null;
  row_count: number;
  valid_count: number;
  error_count: number;
  validation_errors: FiscalIngestValidationError[];
  canonical_rows: FiscalIngestCanonicalPreview[];
  created_at: string;
  updated_at: string;
};

export async function postFiscalIngestCsv(file: File): Promise<{ ingest: FiscalIngestPublic }> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await apiFetch("/v1/portal/fiscal/ingest/csv", { method: "POST", body: form });
  return parseJsonResponse(res, (json) => {
    const o = json as { ingest?: FiscalIngestPublic };
    if (!o.ingest?.id) {
      throw new ApiError("Formato inesperado: ingest ausente", res.status, json);
    }
    return { ingest: o.ingest };
  });
}

export async function fetchFiscalIngestStatus(ingestId: string): Promise<{ ingest: FiscalIngestPublic }> {
  const res = await apiFetch(`/v1/portal/fiscal/ingest/${encodeURIComponent(ingestId)}`, {
    method: "GET"
  });
  return parseJsonResponse(res, (json) => {
    const o = json as { ingest?: FiscalIngestPublic };
    if (!o.ingest?.id) {
      throw new ApiError("Formato inesperado: ingest ausente", res.status, json);
    }
    return { ingest: o.ingest };
  });
}

export async function postProcessamentosFromIngest(
  fiscalIngestId: string
): Promise<{ processamentos: ProcessamentoFiscalRow[] }> {
  const res = await apiFetch("/v1/portal/fiscal/processamentos", {
    method: "POST",
    body: JSON.stringify({ fiscal_ingest_id: fiscalIngestId })
  });
  return parseJsonResponse(res, (json) => {
    const o = json as { processamentos?: ProcessamentoFiscalRow[] };
    if (!Array.isArray(o.processamentos)) {
      throw new ApiError("Formato inesperado: processamentos ausente", res.status, json);
    }
    return { processamentos: o.processamentos };
  });
}

export type ProcessamentoFiscalRow = {
  id: string;
  portal_cliente_id: string;
  fiscal_ingest_id: string | null;
  competencia: string;
  tipo: string;
  status: string;
  valor_apurado: string | null;
  protocolo_serpro: string | null;
  recibo_disponivel: boolean;
  guia_fiscal_id: string | null;
  erro_codigo: string | null;
  created_at: string;
  updated_at: string;
};

export type ProcessamentoEventoRow = {
  id: string;
  evento: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type FiscalDashboardResponse = {
  competencia_atual: string;
  kpis: {
    processamentos_mes: number;
    erros_abertos: number;
    certificados_expirando: number;
  };
  ultimos_processamentos: ProcessamentoFiscalRow[];
  certificados_expirando: Array<{
    id: string;
    portal_cliente_id: string | null;
    label: string;
    valid_until: string;
    status: string;
    days_left: number;
  }>;
};

export async function fetchFiscalDashboard(): Promise<FiscalDashboardResponse> {
  const res = await apiFetch("/v1/portal/fiscal/dashboard", { method: "GET" });
  return parseJsonResponse(res, (json) => {
    const o = json as FiscalDashboardResponse;
    if (!o.kpis || typeof o.competencia_atual !== "string") {
      throw new ApiError("Formato inesperado: dashboard fiscal ausente", res.status, json);
    }
    return {
      competencia_atual: o.competencia_atual,
      kpis: {
        processamentos_mes: Number(o.kpis.processamentos_mes ?? 0),
        erros_abertos: Number(o.kpis.erros_abertos ?? 0),
        certificados_expirando: Number(o.kpis.certificados_expirando ?? 0)
      },
      ultimos_processamentos: o.ultimos_processamentos ?? [],
      certificados_expirando: o.certificados_expirando ?? []
    };
  });
}

export async function fetchProcessamentosFiscais(): Promise<{ processamentos: ProcessamentoFiscalRow[] }> {
  const res = await apiFetch("/v1/portal/fiscal/processamentos", { method: "GET" });
  return parseJsonResponse(res, (json) => {
    const o = json as { processamentos?: ProcessamentoFiscalRow[] };
    if (!Array.isArray(o.processamentos)) {
      throw new ApiError("Formato inesperado: processamentos ausente", res.status, json);
    }
    return { processamentos: o.processamentos };
  });
}

export async function fetchProcessamentoFiscalDetail(
  processamentoId: string
): Promise<{ processamento: ProcessamentoFiscalRow; eventos: ProcessamentoEventoRow[] }> {
  const res = await apiFetch(`/v1/portal/fiscal/processamentos/${encodeURIComponent(processamentoId)}`, {
    method: "GET"
  });
  return parseJsonResponse(res, (json) => {
    const o = json as { processamento?: ProcessamentoFiscalRow; eventos?: ProcessamentoEventoRow[] };
    if (!o.processamento?.id) {
      throw new ApiError("Formato inesperado: processamento ausente", res.status, json);
    }
    return { processamento: o.processamento, eventos: o.eventos ?? [] };
  });
}

export async function fetchProcessamentoReciboUrl(
  processamentoId: string
): Promise<{ pdf_url: string; expires_in_seconds: number }> {
  const res = await apiFetch(
    `/v1/portal/fiscal/processamentos/${encodeURIComponent(processamentoId)}/recibo/url`,
    { method: "GET" }
  );
  return parseJsonResponse(res, (json) => {
    const o = json as { pdf_url?: string; expires_in_seconds?: number };
    if (!o.pdf_url) {
      throw new ApiError("Formato inesperado: pdf_url ausente", res.status, json);
    }
    return {
      pdf_url: o.pdf_url,
      expires_in_seconds: typeof o.expires_in_seconds === "number" ? o.expires_in_seconds : 3600
    };
  });
}

export type ExpiringCertificateRow = {
  id: string;
  portal_cliente_id: string | null;
  label: string;
  valid_until: string;
  status: string;
  days_left: number;
};

export async function fetchExpiringCertificates(): Promise<{ certificados: ExpiringCertificateRow[] }> {
  const res = await apiFetch("/v1/portal/fiscal/certificados/expiring", { method: "GET" });
  return parseJsonResponse(res, (json) => {
    const o = json as { certificados?: ExpiringCertificateRow[] };
    return { certificados: o.certificados ?? [] };
  });
}

export async function postValidarProcuracaoSerpro(body: {
  portal_cliente_id: string;
  contribuinte_cnpj?: string;
}): Promise<{ situacao: string; mensagem: string; procuracao: ProcuracaoRow }> {
  const res = await apiFetch("/v1/portal/fiscal/procuracoes/validar-serpro", {
    method: "POST",
    body: JSON.stringify(body)
  });
  return parseJsonResponse(res, (json) => {
    const o = json as { situacao?: string; mensagem?: string; procuracao?: ProcuracaoRow };
    if (!o.situacao || !o.procuracao?.id) {
      throw new ApiError("Formato inesperado: validacao SERPRO ausente", res.status, json);
    }
    return {
      situacao: o.situacao,
      mensagem: o.mensagem ?? "",
      procuracao: o.procuracao
    };
  });
}

export type SerproConfigRow = {
  organization_id: string;
  ambiente: "demo" | "prod";
  contratante_cnpj: string;
  serpro_enabled: boolean;
  consumer_key_configured: boolean;
  consumer_secret_configured: boolean;
  updated_at: string | null;
};

export type PatchSerproConfigBody = {
  ambiente?: "demo" | "prod";
  contratante_cnpj: string;
  consumer_key?: string;
  consumer_secret?: string;
  serpro_enabled?: boolean;
};

export async function fetchSerproConfig(): Promise<{ serpro_config: SerproConfigRow }> {
  const res = await apiFetch("/v1/portal/fiscal/serpro-config", { method: "GET" });
  return parseJsonResponse(res, (json) => {
    const o = json as { serpro_config?: SerproConfigRow };
    if (!o.serpro_config?.organization_id) {
      throw new ApiError("Formato inesperado: serpro_config ausente", res.status, json);
    }
    return { serpro_config: o.serpro_config };
  });
}

export async function patchSerproConfig(
  body: PatchSerproConfigBody
): Promise<{ serpro_config: SerproConfigRow }> {
  const res = await apiFetch("/v1/portal/fiscal/serpro-config", {
    method: "PATCH",
    body: JSON.stringify(body)
  });
  return parseJsonResponse(res, (json) => {
    const o = json as { serpro_config?: SerproConfigRow };
    if (!o.serpro_config?.organization_id) {
      throw new ApiError("Formato inesperado: serpro_config ausente", res.status, json);
    }
    return { serpro_config: o.serpro_config };
  });
}

export type FiscalAuditLogEntry = {
  id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
};

export type FiscalAuditListResponse = {
  entries: FiscalAuditLogEntry[];
  count: number;
  page_limit?: number;
  next_cursor?: string | null;
};

function fiscalAuditListSearch(q: Record<string, string>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(q)) {
    if (value.trim()) {
      sp.set(key, value.trim());
    }
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export async function fetchFiscalAuditLog(q: Record<string, string>): Promise<FiscalAuditListResponse> {
  const res = await apiFetch(`/v1/portal/fiscal/audit${fiscalAuditListSearch(q)}`, { method: "GET" });
  return parseJsonResponse(res, (json) => {
    const o = json as Partial<FiscalAuditListResponse>;
    if (!Array.isArray(o.entries)) {
      throw new ApiError("Formato inesperado: entries ausente", res.status, json);
    }
    return {
      entries: o.entries as FiscalAuditLogEntry[],
      count: typeof o.count === "number" ? o.count : o.entries.length,
      page_limit: typeof o.page_limit === "number" ? o.page_limit : undefined,
      next_cursor: o.next_cursor === undefined ? undefined : (o.next_cursor as string | null)
    };
  });
}

function parseJsonResponse<T>(res: Response, map: (json: unknown) => T): Promise<T> {
  return res.text().then((text) => {
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
    return map(json);
  });
}
