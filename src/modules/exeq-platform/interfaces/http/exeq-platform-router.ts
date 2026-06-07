import { Router } from "express";
import type { Request, Response } from "express";
import { asyncHandler } from "../../../../platform/http/async-handler";
import { platformMasterAuthMiddleware } from "../../../../platform/http/middleware/platform-master-auth-middleware";
import { authRateLimit } from "../../../../platform/http/middleware/rate-limit.middleware";
import { getPool } from "../../../../platform/persistence/pool";
import {
  addEscritorioAccess,
  EscritorioAccessNotFoundError,
  parseAddEscritorioAccessBody
} from "../../application/add-escritorio-access";
import {
  CreateEscritorioConflictError,
  createEscritorioWithAdmin,
  parseCreateEscritorioBody
} from "../../application/create-escritorio";
import {
  getEscritorioForPlatformMaster,
  listEscritorioMemberships,
  listEscritoriosForPlatformMaster
} from "../../application/list-escritorios";
import { loginPlatformMaster } from "../../application/login-platform-master";
import {
  EscritorioConflictError,
  EscritorioAdminNotFoundError,
  EscritorioNotFoundError as PatchEscritorioNotFoundError,
  parsePatchEscritorioBody,
  patchEscritorio
} from "../../application/patch-escritorio";
import {
  EscritorioNotFoundError,
  parseUpdateEscritorioModulesBody,
  updateEscritorioModules
} from "../../application/update-escritorio-modules";
import { listOrganizations, getOrganizationById } from "../../infrastructure/organization-repository";
import { SaasBillingError } from "../../../saas-billing/domain/saas-billing-error";

async function postAuthLogin(req: Request, res: Response): Promise<void> {
  const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || !password) {
    res.status(400).json({ error: "invalid_body", message: "Informe email e password." });
    return;
  }

  const pool = getPool();
  const result = await loginPlatformMaster(pool, email, password);
  if (result === "invalid_credentials") {
    res.status(401).json({
      error: "invalid_credentials",
      message: "E-mail ou senha invalidos."
    });
    return;
  }
  if (result === "password_not_set") {
    res.status(422).json({
      error: "password_not_set",
      message: "Usuario master sem senha cadastrada."
    });
    return;
  }

  res.json({
    access_token: result.accessToken,
    token_type: "Bearer",
    expires_in: result.expiresIn,
    user: result.user
  });
}

async function getAuthMe(req: Request, res: Response): Promise<void> {
  const auth = req.authContext;
  const master = req.platformMasterUser;
  if (!auth || !master) {
    res.status(500).json({ error: "internal_error", message: "Contexto master incompleto." });
    return;
  }
  res.json({
    user: {
      id: auth.userId,
      email: master.email,
      full_name: master.fullName,
      role: "exeq_platform_master"
    }
  });
}

async function getEscritorios(_req: Request, res: Response): Promise<void> {
  const pool = getPool();
  const data = await listEscritoriosForPlatformMaster(pool);
  res.json({ data, count: data.length });
}

async function getEscritorio(req: Request, res: Response): Promise<void> {
  const id = typeof req.params.escritorioId === "string" ? req.params.escritorioId.trim() : "";
  if (!id) {
    res.status(400).json({ error: "invalid_param", message: "escritorioId obrigatorio." });
    return;
  }
  const pool = getPool();
  const item = await getEscritorioForPlatformMaster(pool, id);
  if (!item) {
    res.status(404).json({ error: "not_found", message: "Escritorio nao encontrado." });
    return;
  }
  const memberships = await listEscritorioMemberships(pool, id);
  res.json({ escritorio: item, memberships });
}

async function postEscritorios(req: Request, res: Response): Promise<void> {
  const parsed = parseCreateEscritorioBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: "invalid_body", message: parsed.message });
    return;
  }

  try {
    const pool = getPool();
    const result = await createEscritorioWithAdmin(pool, parsed.value);
    res.status(201).json({
      escritorio: {
        automacao_tenant_id: result.automacaoTenantId,
        slug: result.slug,
        name: result.name,
        public_tenant_id: result.publicTenantId,
        modules: result.modules
      },
      admin: {
        app_user_id: result.adminUserId,
        email: parsed.value.admin.email,
        role: parsed.value.admin.role ?? "admin_escritorio"
      }
    });
  } catch (error: unknown) {
    if (error instanceof CreateEscritorioConflictError) {
      res.status(409).json({ error: "conflict", message: error.message });
      return;
    }
    if (error instanceof SaasBillingError) {
      res.status(422).json({ error: error.code, message: error.message });
      return;
    }
    throw error;
  }
}

async function patchEscritorioModules(req: Request, res: Response): Promise<void> {
  const id = typeof req.params.escritorioId === "string" ? req.params.escritorioId.trim() : "";
  if (!id) {
    res.status(400).json({ error: "invalid_param", message: "escritorioId obrigatorio." });
    return;
  }
  const parsed = parseUpdateEscritorioModulesBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: "invalid_body", message: parsed.message });
    return;
  }

  try {
    const pool = getPool();
    const modules = await updateEscritorioModules(pool, id, parsed.value);
    res.json({ automacao_tenant_id: id, modules });
  } catch (error: unknown) {
    if (error instanceof EscritorioNotFoundError) {
      res.status(404).json({ error: "not_found", message: error.message });
      return;
    }
    throw error;
  }
}

async function patchEscritorioHttp(req: Request, res: Response): Promise<void> {
  const id = typeof req.params.escritorioId === "string" ? req.params.escritorioId.trim() : "";
  if (!id) {
    res.status(400).json({ error: "invalid_param", message: "escritorioId obrigatorio." });
    return;
  }
  const parsed = parsePatchEscritorioBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: "invalid_body", message: parsed.message });
    return;
  }

  try {
    const pool = getPool();
    const result = await patchEscritorio(pool, id, parsed.value);
    res.json({
      escritorio: {
        automacao_tenant_id: result.automacaoTenantId,
        name: result.name,
        active: result.active,
        modules: result.modules
      }
    });
  } catch (error: unknown) {
    if (error instanceof PatchEscritorioNotFoundError) {
      res.status(404).json({ error: "not_found", message: error.message });
      return;
    }
    if (error instanceof EscritorioAdminNotFoundError) {
      res.status(404).json({ error: "admin_not_found", message: error.message });
      return;
    }
    if (error instanceof EscritorioConflictError) {
      res.status(409).json({ error: "conflict", message: error.message });
      return;
    }
    throw error;
  }
}

async function getOrganizations(_req: Request, res: Response): Promise<void> {
  const pool = getPool();
  const data = await listOrganizations(pool);
  res.json({ data, count: data.length });
}

async function getOrganization(req: Request, res: Response): Promise<void> {
  const id = typeof req.params.organizationId === "string" ? req.params.organizationId.trim() : "";
  if (!id) {
    res.status(400).json({ error: "invalid_param", message: "organizationId obrigatorio." });
    return;
  }
  const pool = getPool();
  const org = await getOrganizationById(pool, id);
  if (!org) {
    res.status(404).json({ error: "not_found", message: "Organizacao nao encontrada." });
    return;
  }
  res.json({ organization: org });
}

async function postEscritorioAccess(req: Request, res: Response): Promise<void> {
  const id = typeof req.params.escritorioId === "string" ? req.params.escritorioId.trim() : "";
  if (!id) {
    res.status(400).json({ error: "invalid_param", message: "escritorioId obrigatorio." });
    return;
  }
  const parsed = parseAddEscritorioAccessBody(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: "invalid_body", message: parsed.message });
    return;
  }

  try {
    const pool = getPool();
    const result = await addEscritorioAccess(pool, id, parsed.value);
    res.status(201).json({
      app_user_id: result.appUserId,
      membership_id: result.membershipId,
      email: parsed.value.email,
      role: parsed.value.role
    });
  } catch (error: unknown) {
    if (error instanceof EscritorioAccessNotFoundError) {
      res.status(404).json({ error: "not_found", message: error.message });
      return;
    }
    throw error;
  }
}

export function createExeqPlatformRouter(): Router {
  const router = Router();

  router.post("/auth/login", authRateLimit, asyncHandler(postAuthLogin));

  const protectedRoutes = Router();
  protectedRoutes.use(asyncHandler(platformMasterAuthMiddleware));
  protectedRoutes.get("/auth/me", asyncHandler(getAuthMe));
  protectedRoutes.get("/escritorios", asyncHandler(getEscritorios));
  protectedRoutes.get("/organizations", asyncHandler(getOrganizations));
  protectedRoutes.get("/organizations/:organizationId", asyncHandler(getOrganization));
  protectedRoutes.get("/escritorios/:escritorioId", asyncHandler(getEscritorio));
  protectedRoutes.post("/escritorios", asyncHandler(postEscritorios));
  protectedRoutes.patch("/escritorios/:escritorioId", asyncHandler(patchEscritorioHttp));
  protectedRoutes.patch("/escritorios/:escritorioId/modules", asyncHandler(patchEscritorioModules));
  protectedRoutes.post("/escritorios/:escritorioId/access", asyncHandler(postEscritorioAccess));

  router.use(protectedRoutes);
  return router;
}
