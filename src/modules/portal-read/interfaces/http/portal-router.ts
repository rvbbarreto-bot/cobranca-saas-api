import { Router } from "express";
import type { Request, Response } from "express";
import { DatabaseError } from "pg";
import { asyncHandler } from "../../../../platform/http/async-handler";
import { authJwtMiddleware } from "../../../../platform/http/middleware/auth-jwt-middleware";
import { mockAuthRoutesGate } from "../../../../platform/http/middleware/mock-auth-routes-gate";
import { portalAutomacaoTenantMiddleware } from "../../../../platform/http/middleware/portal-automacao-tenant-middleware";
import { portalMembershipMiddleware } from "../../../../platform/http/middleware/portal-membership-middleware";
import { signAccessToken } from "../../../identity-access/application/jwt-service";
import { auditContextFromRequest } from "../../../../platform/audit/audit-context";
import { getPool } from "../../../../platform/persistence/pool";
import { withTenantTransaction } from "../../../../platform/persistence/with-tenant-transaction";
import { cancelChargeUseCase } from "../../../billing-core/application/cancel-charge";
import {
  listChargesByPortalClienteIdPage,
  listChargesPage,
  type ChargeKeysetCursor
} from "../../../billing-core/infrastructure/charge-repository";
import { getPublicTenantIdForAutomacao } from "../../infrastructure/billing-tenant-link-repository";
import { createPortalChargeUseCase } from "../../application/create-portal-charge";
import { getPortalChargeDetailUseCase } from "../../application/get-portal-charge-detail";
import { patchPortalChargeUseCase } from "../../application/patch-portal-charge";
import { parsePortalClienteCreateBody, parsePortalClientePatchBody } from "../../application/portal-cliente-input";
import {
  getClienteByIdForTenant,
  insertCliente,
  listClientesByTenantPage,
  type ClienteKeysetCursor,
  updateClienteForTenant
} from "../../infrastructure/portal-cliente-repository";
import {
  listNotasFiscaisResumoByTenantPage,
  type NfKeysetCursor
} from "../../infrastructure/notas-fiscais-repository";
import {
  chargeCursorFromCharge,
  clienteCursorFromRow,
  nfCursorFromNotaRow,
  parseChargeListCursor,
  parseClienteListCursor,
  parseNfListCursor,
  parsePortalListLimit
} from "../../application/portal-list-cursor";
import { verifyPortalPassword } from "../../application/portal-password";
import { recordPortalLoginAuditInTransaction } from "../../application/record-portal-login-audit";
import { authRateLimit } from "../../../../platform/http/middleware/rate-limit.middleware";
import { createEscritorioRouter } from "./escritorio-router";
import { createClientePortalRouter } from "./cliente-portal-router";
import { SaasBillingError } from "../../../saas-billing/domain/saas-billing-error";
import { assertTenantCanMutate } from "../../../saas-billing/application/assert-tenant-can-mutate";
import { resolveAutomacaoTenantId } from "../../../../platform/tenancy/resolve-automacao-tenant-id";

/**
 * Login portal com senha (Sprint A). Disponivel em producao — nao passa por mockAuthRoutesGate.
 * Requer `password_hash` no usuario (migracao 011 + seed ou script admin).
 */
async function portalLoginWithPassword(req: Request, res: Response): Promise<void> {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const tenantId = typeof req.body?.tenant_id === "string" ? req.body.tenant_id.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !tenantId || !password) {
    res.status(400).json({
      error: "invalid_body",
      message: "Informe email, tenant_id e password."
    });
    return;
  }

  const automacaoTenantId = await resolveAutomacaoTenantId(tenantId);
  if (!automacaoTenantId) {
    res.status(403).json({
      error: "portal_auth_forbidden",
      message: "Email, tenant ou senha invalidos."
    });
    return;
  }

  const pool = getPool();
  const q = await pool.query<{ app_user_id: string; tenant_id: string; password_hash: string | null }>(
    `SELECT u.id::text AS app_user_id, m.tenant_id, u.password_hash
     FROM portal.app_user u
     INNER JOIN portal.membership m ON m.app_user_id = u.id
     WHERE lower(u.email) = lower($1) AND m.tenant_id = $2
     LIMIT 1`,
    [email, automacaoTenantId]
  );

  const row = q.rows[0];
  if (!row) {
    res.status(403).json({
      error: "portal_auth_forbidden",
      message: "Email, tenant ou senha invalidos."
    });
    return;
  }

  if (!row.password_hash) {
    res.status(422).json({
      error: "portal_password_not_set",
      message:
        "Usuario sem senha cadastrada. Defina password_hash (bcrypt) no banco ou use fluxo de desenvolvimento conforme politica."
    });
    return;
  }

  const ok = await verifyPortalPassword(password, row.password_hash);
  if (!ok) {
    res.status(401).json({
      error: "invalid_credentials",
      message: "Email, tenant ou senha invalidos."
    });
    return;
  }

  await recordPortalLoginAuditInTransaction(pool, {
    automacaoTenantId: row.tenant_id,
    appUserId: row.app_user_id,
    audit: auditContextFromRequest(req)
  });

  const token = signAccessToken({
    sub: row.app_user_id,
    tid: row.tenant_id,
    roles: ["owner"]
  });

  res.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: 900
  });
}

async function issuePortalMockToken(req: Request, res: Response): Promise<void> {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const tenantId = typeof req.body?.tenant_id === "string" ? req.body.tenant_id.trim() : "";
  if (!email || !tenantId) {
    res.status(400).json({
      error: "invalid_body",
      message: "Informe email e tenant_id (texto como em portal.membership.tenant_id)."
    });
    return;
  }

  const pool = getPool();
  const q = await pool.query<{ app_user_id: string; tenant_id: string }>(
    `SELECT u.id::text AS app_user_id, m.tenant_id
     FROM portal.app_user u
     INNER JOIN portal.membership m ON m.app_user_id = u.id
     WHERE lower(u.email) = lower($1) AND m.tenant_id = $2
     LIMIT 1`,
    [email, tenantId]
  );

  if (!q.rows[0]) {
    res.status(403).json({
      error: "portal_auth_forbidden",
      message: "Email ou tenant sem membership no portal."
    });
    return;
  }

  const row = q.rows[0];
  const token = signAccessToken({
    sub: row.app_user_id,
    tid: row.tenant_id,
    roles: ["owner"]
  });

  res.json({
    access_token: token,
    token_type: "Bearer",
    expires_in: 900
  });
}

function firstQueryString(v: unknown): string | undefined {
  if (typeof v === "string") {
    return v;
  }
  if (Array.isArray(v) && typeof v[0] === "string") {
    return v[0];
  }
  return undefined;
}

async function listNotasFiscais(req: Request, res: Response): Promise<void> {
  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  const limit = parsePortalListLimit(req.query.limit, 50);
  const curRaw = firstQueryString(req.query.cursor);
  const parsed = parseNfListCursor(curRaw);
  if (parsed === "invalid") {
    res.status(400).json({ error: "invalid_cursor", message: "Parametro cursor invalido." });
    return;
  }
  const keyset: NfKeysetCursor | null = parsed
    ? { createdAtIso: parsed.ca, id: parsed.id }
    : null;

  const { items, has_more } = await listNotasFiscaisResumoByTenantPage(tenantId, { limit, cursor: keyset });
  const last = items[items.length - 1];
  let next_cursor: string | null = null;
  if (has_more && last) {
    next_cursor = nfCursorFromNotaRow({ id: last.id, created_at: last.created_at });
  }

  res.json({
    data: items,
    count: items.length,
    page_limit: limit,
    next_cursor
  });
}

/** Perfil do utilizador autenticado (header do portal). */
async function portalAuthMe(req: Request, res: Response): Promise<void> {
  const auth = req.authContext;
  const pm = req.portalMembership;
  const tenant = req.tenantContext;
  if (!auth || !pm || !tenant) {
    res.status(500).json({ error: "internal_error", message: "Contexto portal incompleto." });
    return;
  }

  const pool = getPool();
  const u = await pool.query<{ email: string; full_name: string | null }>(
    `SELECT email, full_name FROM portal.app_user WHERE id = $1::uuid LIMIT 1`,
    [auth.userId]
  );
  const row = u.rows[0];
  res.json({
    user: {
      id: auth.userId,
      email: row?.email ?? null,
      full_name: row?.full_name ?? null,
      membership_role: pm.role,
      jwt_roles: auth.roles
    },
    tenant: {
      id: tenant.tenantId,
      slug: tenant.tenantSlug ?? null
    }
  });
}

async function listCobrancas(req: Request, res: Response): Promise<void> {
  const automacaoTenantId = req.tenantContext?.tenantId;
  if (!automacaoTenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  const limit = parsePortalListLimit(req.query.limit, 50);
  const curRaw = firstQueryString(req.query.cursor);
  const parsed = parseChargeListCursor(curRaw);
  if (parsed === "invalid") {
    res.status(400).json({ error: "invalid_cursor", message: "Parametro cursor invalido." });
    return;
  }
  const keyset: ChargeKeysetCursor | null = parsed
    ? { createdAtIso: parsed.ca, id: parsed.id }
    : null;

  const publicTenantId = await getPublicTenantIdForAutomacao(automacaoTenantId);
  if (!publicTenantId) {
    res.json({
      data: [],
      count: 0,
      page_limit: limit,
      next_cursor: null,
      billing_link_status: "missing",
      message:
        "Sem vínculo em portal.billing_tenant_link para este escritório. Rode a migração 008 e insira automacao_tenant_id + public_tenant_id (UUID de public.tenants)."
    });
    return;
  }

  const { items, has_more } = await withTenantTransaction(publicTenantId, (client) =>
    listChargesPage(client, { limit, cursor: keyset })
  );
  const last = items[items.length - 1];
  const next_cursor = has_more && last ? chargeCursorFromCharge(last) : null;

  res.json({
    data: items,
    count: items.length,
    page_limit: limit,
    next_cursor,
    billing_link_status: "ok"
  });
}

function isEscritorioStaff(req: Request): boolean {
  const role = req.portalMembership?.role;
  return role === "admin_escritorio" || role === "operador";
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

async function listClientes(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem listar clientes."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  const limit = parsePortalListLimit(req.query.limit, 50);
  const curRaw = firstQueryString(req.query.cursor);
  const parsed = parseClienteListCursor(curRaw);
  if (parsed === "invalid") {
    res.status(400).json({ error: "invalid_cursor", message: "Parametro cursor invalido." });
    return;
  }
  const keyset: ClienteKeysetCursor | null = parsed ? { nome: parsed.nome, id: parsed.id } : null;

  const searchRaw = firstQueryString(req.query.search);
  const search = searchRaw && searchRaw.length >= 2 ? searchRaw.slice(0, 80) : null;
  const { items, has_more } = await listClientesByTenantPage(tenantId, { limit, cursor: keyset, search });
  const last = items[items.length - 1];
  const next_cursor = has_more && last ? clienteCursorFromRow(last) : null;

  res.json({
    data: items,
    count: items.length,
    page_limit: limit,
    next_cursor
  });
}

async function getPortalCobrancaHttp(req: Request, res: Response): Promise<void> {
  const automacaoTenantId = req.tenantContext?.tenantId;
  const chargeId = typeof req.params.chargeId === "string" ? req.params.chargeId.trim() : "";
  if (!automacaoTenantId || !chargeId || !isUuid(chargeId)) {
    res.status(400).json({ error: "invalid_request", message: "tenant ou charge_id invalido." });
    return;
  }

  const publicTenantId = await getPublicTenantIdForAutomacao(automacaoTenantId);
  if (!publicTenantId) {
    res.status(409).json({
      error: "billing_link_missing",
      message: "Configure portal.billing_tenant_link antes de consultar cobranca."
    });
    return;
  }

  const detail = await withTenantTransaction(publicTenantId, (client) =>
    getPortalChargeDetailUseCase(client, chargeId, publicTenantId)
  );

  if (!detail) {
    res.status(404).json({
      error: "charge_not_found",
      message: "Cobranca inexistente neste tenant de faturacao."
    });
    return;
  }

  res.json({
    charge: detail.charge,
    payment: detail.payment,
    events: detail.events
  });
}

async function createPortalChargeHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem emitir cobranca pelo portal."
    });
    return;
  }

  const automacaoTenantId = req.tenantContext?.tenantId;
  if (!automacaoTenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  const publicTenantId = await getPublicTenantIdForAutomacao(automacaoTenantId);
  if (!publicTenantId) {
    res.status(409).json({
      error: "billing_link_missing",
      message: "Configure portal.billing_tenant_link antes de emitir cobranca (migracao 008)."
    });
    return;
  }

  try {
    const audit = auditContextFromRequest(req);
    const result = await withTenantTransaction(publicTenantId, (client) =>
      createPortalChargeUseCase(client, automacaoTenantId, publicTenantId, req.body, audit)
    );
    res.status(result.inserted ? 201 : 200).json({
      charge: result.charge,
      idempotent: !result.inserted
    });
  } catch (error: unknown) {
    const err = error as Error & { issues?: unknown };
    if (err.message === "VALIDATION_ERROR" || err.message === "PORTAL_CHARGE_VALIDATION") {
      res.status(422).json({ error: "validation_error", issues: err.issues });
      return;
    }
    if (err.message === "PORTAL_CLIENTE_NOT_FOUND") {
      res.status(404).json({
        error: "portal_cliente_not_found",
        message: "Cliente inexistente ou nao pertence a este escritorio."
      });
      return;
    }
    if (error instanceof SaasBillingError) {
      const status =
        error.code === "SUBSCRIPTION_READ_ONLY"
          ? 403
          : error.code === "LIMIT_COBRANCAS_MES" || error.code === "LIMIT_CLIENTES"
            ? 402
            : 400;
      res.status(status).json({ error: error.code, message: error.message });
      return;
    }
    if (error instanceof DatabaseError) {
      const pgErr = error;
      if (pgErr.code === "23505") {
        res.status(409).json({
          error: "unique_violation",
          message: "Referencia ou idempotency_key ja existente para este tenant."
        });
        return;
      }
    }
    throw error;
  }
}

async function getPortalClienteHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem consultar clientes."
    });
    return;
  }

  const automacaoTenantId = req.tenantContext?.tenantId;
  const clienteId = typeof req.params.clienteId === "string" ? req.params.clienteId.trim() : "";
  if (!automacaoTenantId || !clienteId || !isUuid(clienteId)) {
    res.status(400).json({ error: "invalid_request", message: "tenant ou cliente_id invalido." });
    return;
  }

  const cliente = await getClienteByIdForTenant(clienteId, automacaoTenantId);
  if (!cliente) {
    res.status(404).json({ error: "portal_cliente_not_found", message: "Cliente nao encontrado." });
    return;
  }

  res.json({ cliente });
}

async function listClienteCobrancasHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem listar cobrancas por cliente."
    });
    return;
  }

  const automacaoTenantId = req.tenantContext?.tenantId;
  const clienteId = typeof req.params.clienteId === "string" ? req.params.clienteId.trim() : "";
  if (!automacaoTenantId || !clienteId) {
    res.status(400).json({ error: "invalid_request", message: "tenant ou cliente_id invalido." });
    return;
  }

  const cliente = await getClienteByIdForTenant(clienteId, automacaoTenantId);
  if (!cliente) {
    res.status(404).json({ error: "portal_cliente_not_found", message: "Cliente nao encontrado." });
    return;
  }

  const limit = parsePortalListLimit(req.query.limit, 50);
  const curRaw = firstQueryString(req.query.cursor);
  const parsed = parseChargeListCursor(curRaw);
  if (parsed === "invalid") {
    res.status(400).json({ error: "invalid_cursor", message: "Parametro cursor invalido." });
    return;
  }
  const keyset: ChargeKeysetCursor | null = parsed
    ? { createdAtIso: parsed.ca, id: parsed.id }
    : null;

  const publicTenantId = await getPublicTenantIdForAutomacao(automacaoTenantId);
  if (!publicTenantId) {
    res.json({
      data: [],
      count: 0,
      page_limit: limit,
      next_cursor: null,
      billing_link_status: "missing",
      message:
        "Sem vínculo em portal.billing_tenant_link; nao e possivel ler cobrancas do tenant publico."
    });
    return;
  }

  const { items, has_more } = await withTenantTransaction(publicTenantId, (client) =>
    listChargesByPortalClienteIdPage(client, cliente.id, { limit, cursor: keyset })
  );
  const last = items[items.length - 1];
  const next_cursor = has_more && last ? chargeCursorFromCharge(last) : null;

  res.json({
    data: items,
    count: items.length,
    page_limit: limit,
    next_cursor,
    billing_link_status: "ok",
    cliente: { id: cliente.id, nome: cliente.nome, documento: cliente.documento }
  });
}

async function patchPortalClienteHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem atualizar clientes."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  const clienteId = typeof req.params.clienteId === "string" ? req.params.clienteId.trim() : "";
  if (!tenantId || !clienteId || !isUuid(clienteId)) {
    res.status(400).json({ error: "invalid_request", message: "tenant ou cliente_id invalido." });
    return;
  }

  const parsed = parsePortalClientePatchBody(req.body);
  if (!parsed.ok) {
    res.status(422).json({ error: "validation_error", issues: parsed.issues });
    return;
  }

  try {
    const row = await updateClienteForTenant(clienteId, tenantId, parsed.value);
    if (!row) {
      res.status(404).json({ error: "portal_cliente_not_found", message: "Cliente nao encontrado." });
      return;
    }
    res.json({ cliente: row });
  } catch (err) {
    if (err instanceof Error && err.message === "portal_cliente_telefone_required_for_optin") {
      res.status(422).json({
        error: "validation_error",
        issues: [{ path: "telefone", message: "Telefone obrigatorio quando whatsapp_opt_in for true." }]
      });
      return;
    }
    throw err;
  }
}

async function patchPortalCobrancaHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem atualizar cobrancas."
    });
    return;
  }

  const automacaoTenantId = req.tenantContext?.tenantId;
  const chargeId = typeof req.params.chargeId === "string" ? req.params.chargeId.trim() : "";
  if (!automacaoTenantId || !chargeId || !isUuid(chargeId)) {
    res.status(400).json({ error: "invalid_request", message: "tenant ou charge_id invalido." });
    return;
  }

  const publicTenantId = await getPublicTenantIdForAutomacao(automacaoTenantId);
  if (!publicTenantId) {
    res.status(409).json({
      error: "billing_link_missing",
      message: "Configure portal.billing_tenant_link antes de atualizar cobranca."
    });
    return;
  }

  const result = await withTenantTransaction(publicTenantId, (client) =>
    patchPortalChargeUseCase(client, chargeId, req.body)
  );

  if (!result.ok) {
    if (result.kind === "validation") {
      res.status(422).json({ error: "validation_error", issues: result.issues });
      return;
    }
    if (result.kind === "not_found") {
      res.status(404).json({
        error: "charge_not_found",
        message: "Cobranca inexistente neste tenant de faturacao."
      });
      return;
    }
    res.status(409).json({
      error: "charge_not_editable",
      message: "Cobranca paga ou cancelada nao pode ser alterada pelo portal."
    });
    return;
  }

  res.json({ charge: result.charge });
}

async function cancelPortalCobrancaHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem cancelar cobrancas."
    });
    return;
  }

  const automacaoTenantId = req.tenantContext?.tenantId;
  const chargeId = typeof req.params.chargeId === "string" ? req.params.chargeId.trim() : "";
  if (!automacaoTenantId || !chargeId || !isUuid(chargeId)) {
    res.status(400).json({ error: "invalid_request", message: "tenant ou charge_id invalido." });
    return;
  }

  const publicTenantId = await getPublicTenantIdForAutomacao(automacaoTenantId);
  if (!publicTenantId) {
    res.status(409).json({
      error: "billing_link_missing",
      message: "Configure portal.billing_tenant_link antes de cancelar cobranca."
    });
    return;
  }

  const audit = auditContextFromRequest(req);
  const result = await withTenantTransaction(publicTenantId, (client) =>
    cancelChargeUseCase(client, chargeId, audit)
  );

  if (!result.ok) {
    if (result.kind === "not_found") {
      res.status(404).json({
        error: "charge_not_found",
        message: "Cobranca inexistente neste tenant de faturacao."
      });
      return;
    }
    res.status(409).json({
      error: "illegal_status_transition",
      message: `Nao e possivel cancelar cobranca em status ${result.from}.`,
      from: result.from,
      to: result.to
    });
    return;
  }

  res.json({ charge: result.charge });
}

async function createCliente(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem cadastrar clientes."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  const parsed = parsePortalClienteCreateBody(req.body);
  if (!parsed.ok) {
    res.status(422).json({ error: "validation_error", issues: parsed.issues });
    return;
  }

  const publicTenantId = await getPublicTenantIdForAutomacao(tenantId);
  if (!publicTenantId) {
    res.status(409).json({
      error: "billing_link_missing",
      message: "Configure portal.billing_tenant_link antes de cadastrar clientes."
    });
    return;
  }

  try {
    await withTenantTransaction(publicTenantId, (client) =>
      assertTenantCanMutate(client, publicTenantId, "create_cliente")
    );
    const row = await insertCliente(tenantId, parsed.value);
    res.status(201).json({ cliente: row });
  } catch (error: unknown) {
    if (error instanceof SaasBillingError) {
      const status =
        error.code === "SUBSCRIPTION_READ_ONLY"
          ? 403
          : error.code === "LIMIT_CLIENTES"
            ? 402
            : 400;
      res.status(status).json({ error: error.code, message: error.message });
      return;
    }
    if (error instanceof DatabaseError && error.code === "23505") {
      res.status(409).json({
        error: "unique_violation",
        message: "Cliente com este documento ja cadastrado para o escritorio."
      });
      return;
    }
    throw error;
  }
}

export function createPortalRouter(): Router {
  const router = Router();

  router.post("/auth/login", authRateLimit, asyncHandler(portalLoginWithPassword));
  router.post("/auth/token/mock", mockAuthRoutesGate, asyncHandler(issuePortalMockToken));
  router.use("/cliente", createClientePortalRouter());

  const protectedRoutes = Router();
  protectedRoutes.use(asyncHandler(portalAutomacaoTenantMiddleware));
  protectedRoutes.use(authJwtMiddleware);
  protectedRoutes.use(asyncHandler(portalMembershipMiddleware));
  protectedRoutes.get("/auth/me", asyncHandler(portalAuthMe));
  protectedRoutes.get("/notas-fiscais", asyncHandler(listNotasFiscais));
  protectedRoutes.get("/cobrancas", asyncHandler(listCobrancas));
  protectedRoutes.get("/cobrancas/:chargeId", asyncHandler(getPortalCobrancaHttp));
  protectedRoutes.post("/cobrancas", asyncHandler(createPortalChargeHttp));
  protectedRoutes.post("/cobrancas/:chargeId/cancel", asyncHandler(cancelPortalCobrancaHttp));
  protectedRoutes.patch("/cobrancas/:chargeId", asyncHandler(patchPortalCobrancaHttp));
  protectedRoutes.get("/clientes", asyncHandler(listClientes));
  protectedRoutes.get("/clientes/:clienteId", asyncHandler(getPortalClienteHttp));
  protectedRoutes.get("/clientes/:clienteId/cobrancas", asyncHandler(listClienteCobrancasHttp));
  protectedRoutes.patch("/clientes/:clienteId", asyncHandler(patchPortalClienteHttp));
  protectedRoutes.post("/clientes", asyncHandler(createCliente));
  protectedRoutes.use("/escritorio", createEscritorioRouter());

  router.use(protectedRoutes);
  return router;
}
