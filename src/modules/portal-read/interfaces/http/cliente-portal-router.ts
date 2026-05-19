import { Router } from "express";
import { asyncHandler } from "../../../../platform/http/async-handler";
import { authRateLimit } from "../../../../platform/http/middleware/rate-limit.middleware";
import { portalAutomacaoTenantMiddleware } from "../../../../platform/http/middleware/portal-automacao-tenant-middleware";
import { authJwtMiddleware } from "../../../../platform/http/middleware/auth-jwt-middleware";
import { portalClienteAuthMiddleware } from "../../../../platform/http/middleware/portal-cliente-auth-middleware";
import { resolveAutomacaoTenantId } from "../../../../platform/tenancy/resolve-automacao-tenant-id";
import { withTenantTransaction } from "../../../../platform/persistence/with-tenant-transaction";
import { auditContextFromRequest } from "../../../../platform/audit/audit-context";
import { signClientePortalToken } from "../../../identity-access/application/jwt-service";
import {
  requestClienteMagicLink,
  verifyClienteMagicLinkToken
} from "../../application/cliente-magic-link";
import {
  clienteOwnsCharge,
  getClienteCobrancaDetail,
  listClienteCobrancas
} from "../../application/cliente-portal-cobrancas";
import { getPublicTenantIdForAutomacao } from "../../infrastructure/billing-tenant-link-repository";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function resolveTenantFromSlug(slug: string): Promise<string | null> {
  return resolveAutomacaoTenantId(slug.trim());
}

/** Rotas HTTP em /v1/portal/cliente (magic link + cobranças do devedor). */
export function createClientePortalRouter(): Router {
  const router = Router();

  router.post(
    "/auth/request-access",
    authRateLimit,
    asyncHandler(async (req, res) => {
      const email = typeof req.body?.email === "string" ? req.body.email.trim() : "";
      const tenantSlug = typeof req.body?.tenant_slug === "string" ? req.body.tenant_slug.trim() : "";
      if (!email || !tenantSlug) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }

      const automacaoTenantId = await resolveTenantFromSlug(tenantSlug);
      if (automacaoTenantId) {
        await withTenantTransaction(automacaoTenantId, (client) =>
          requestClienteMagicLink(
            client,
            { email, automacaoTenantId, tenantSlug },
            auditContextFromRequest(req)
          )
        );
      }

      res.status(200).json({
        message: "Se o e-mail existir, você receberá um link de acesso."
      });
    })
  );

  router.post(
    "/auth/verify-token",
    authRateLimit,
    asyncHandler(async (req, res) => {
      const token = typeof req.body?.token === "string" ? req.body.token.trim() : "";
      const tenantSlug = typeof req.body?.tenant_slug === "string" ? req.body.tenant_slug.trim() : "";
      if (!token || !tenantSlug) {
        res.status(400).json({ error: "invalid_body" });
        return;
      }

      const automacaoTenantId = await resolveTenantFromSlug(tenantSlug);
      if (!automacaoTenantId) {
        res.status(401).json({ error: "invalid_token" });
        return;
      }

      const verified = await withTenantTransaction(automacaoTenantId, (client) =>
        verifyClienteMagicLinkToken(client, token, automacaoTenantId, auditContextFromRequest(req))
      );

      if (!verified) {
        res.status(401).json({ error: "invalid_token", message: "Token invalido, expirado ou ja utilizado." });
        return;
      }

      const jwt = signClientePortalToken(verified.clienteId, automacaoTenantId);
      res.json({ token: jwt, token_type: "Bearer", expires_in: 14_400 });
    })
  );

  const protectedRoutes = Router();
  protectedRoutes.use(asyncHandler(portalAutomacaoTenantMiddleware));
  protectedRoutes.use(authJwtMiddleware);
  protectedRoutes.use(portalClienteAuthMiddleware);

  protectedRoutes.get(
    "/cobrancas",
    asyncHandler(async (req, res) => {
      const ctx = req.portalCliente;
      if (!ctx) {
        res.status(500).json({ error: "internal_error" });
        return;
      }
      const publicTenantId = await getPublicTenantIdForAutomacao(ctx.automacaoTenantId);
      if (!publicTenantId) {
        res.status(409).json({ error: "billing_link_missing" });
        return;
      }

      const status =
        typeof req.query.status === "string" ? req.query.status.trim() : undefined;
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

      const data = await withTenantTransaction(publicTenantId, (client) =>
        listClienteCobrancas(client, publicTenantId, ctx.clienteId, { status, page, limit })
      );
      res.json({ data, page, limit });
    })
  );

  protectedRoutes.get(
    "/cobrancas/:chargeId",
    asyncHandler(async (req, res) => {
      const ctx = req.portalCliente;
      const chargeId = String(req.params.chargeId ?? "").trim();
      if (!ctx || !isUuid(chargeId)) {
        res.status(400).json({ error: "invalid_request" });
        return;
      }
      const publicTenantId = await getPublicTenantIdForAutomacao(ctx.automacaoTenantId);
      if (!publicTenantId) {
        res.status(409).json({ error: "billing_link_missing" });
        return;
      }

      const owns = await withTenantTransaction(publicTenantId, (client) =>
        clienteOwnsCharge(client, publicTenantId, chargeId, ctx.clienteId)
      );
      if (!owns) {
        res.status(403).json({ error: "forbidden" });
        return;
      }

      const detail = await withTenantTransaction(publicTenantId, (client) =>
        getClienteCobrancaDetail(client, publicTenantId, chargeId, ctx.clienteId)
      );
      if (!detail) {
        res.status(404).json({ error: "not_found" });
        return;
      }
      res.json(detail);
    })
  );

  protectedRoutes.get(
    "/cobrancas/:chargeId/boleto",
    asyncHandler(async (req, res) => {
      const ctx = req.portalCliente;
      const chargeId = String(req.params.chargeId ?? "").trim();
      if (!ctx || !isUuid(chargeId)) {
        res.status(400).json({ error: "invalid_request" });
        return;
      }
      const publicTenantId = await getPublicTenantIdForAutomacao(ctx.automacaoTenantId);
      if (!publicTenantId) {
        res.status(409).json({ error: "billing_link_missing" });
        return;
      }

      const detail = await withTenantTransaction(publicTenantId, async (client) => {
        const owns = await clienteOwnsCharge(client, publicTenantId, chargeId, ctx.clienteId);
        if (!owns) {
          return { forbidden: true as const };
        }
        const row = await getClienteCobrancaDetail(client, publicTenantId, chargeId, ctx.clienteId);
        return { forbidden: false as const, detail: row };
      });

      if (detail.forbidden) {
        res.status(403).json({ error: "forbidden" });
        return;
      }

      const charge = detail.detail;
      if (!charge) {
        res.status(404).json({ error: "not_found" });
        return;
      }

      if (charge.canonical_status === "paga" || charge.canonical_status === "cancelada") {
        res.status(404).json({ error: "boleto_not_found" });
        return;
      }

      const url = charge.payment?.boleto_url;
      if (!url) {
        res.status(404).json({ error: "boleto_not_found" });
        return;
      }
      res.redirect(302, url);
    })
  );

  router.use(protectedRoutes);
  return router;
}
