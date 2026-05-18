import type { Request, Response } from "express";
import { getPublicTenantIdForAutomacao } from "../../../portal-read/infrastructure/billing-tenant-link-repository";
import { withTenantTransaction } from "../../../../platform/persistence/with-tenant-transaction";
import { getNfseByCharge, chargeBelongsToTenant } from "../../application/nfse-portal-queries";
import { fetchNfsePdfStream } from "../../application/nfse-pdf-proxy";
import { enqueueNfseEmitJob } from "../../../../platform/jobs/enqueue-nfse-emit";
import { getPool } from "../../../../platform/persistence/pool";

function isUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

async function resolvePublicTenant(req: Request, res: Response): Promise<string | null> {
  const automacaoTenantId = req.tenantContext?.tenantId;
  if (!automacaoTenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return null;
  }
  const publicTenantId = await getPublicTenantIdForAutomacao(automacaoTenantId);
  if (!publicTenantId) {
    res.status(409).json({
      error: "billing_link_missing",
      message: "Configure portal.billing_tenant_link."
    });
    return null;
  }
  return publicTenantId;
}

export async function getPortalNfseHandler(req: Request, res: Response): Promise<void> {
  const chargeId = String(req.params.chargeId ?? "").trim();
  if (!isUuid(chargeId)) {
    res.status(400).json({ error: "invalid_request", message: "charge_id invalido." });
    return;
  }
  const publicTenantId = await resolvePublicTenant(req, res);
  if (!publicTenantId) return;

  const nfse = await withTenantTransaction(publicTenantId, async (client) => {
    const ok = await chargeBelongsToTenant(client, chargeId, publicTenantId);
    if (!ok) return null;
    return getNfseByCharge(client, chargeId, publicTenantId);
  });

  if (!nfse) {
    res.status(404).json({ error: "nfse_not_found", message: "NFS-e nao iniciada para esta cobranca." });
    return;
  }

  res.json({
    status: nfse.status,
    numero_nfse: nfse.numero_nfse,
    codigo_verificacao: nfse.codigo_verificacao,
    pdf_url: nfse.pdf_url,
    xml_url: nfse.xml_url,
    emitted_at: nfse.emitted_at,
    error_message: nfse.error_message
  });
}

export async function getPortalNfsePdfHandler(req: Request, res: Response): Promise<void> {
  const chargeId = String(req.params.chargeId ?? "").trim();
  if (!isUuid(chargeId)) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }
  const publicTenantId = await resolvePublicTenant(req, res);
  if (!publicTenantId) return;

  const nfse = await withTenantTransaction(publicTenantId, async (client) => {
    const ok = await chargeBelongsToTenant(client, chargeId, publicTenantId);
    if (!ok) return null;
    return getNfseByCharge(client, chargeId, publicTenantId);
  });

  if (!nfse || nfse.status !== "autorizado" || !nfse.pdf_url) {
    res.status(404).json({ error: "nfse_pdf_unavailable" });
    return;
  }

  const { body, contentType } = await fetchNfsePdfStream(nfse.pdf_url);
  const filename = `nfse-${nfse.numero_nfse ?? chargeId}.pdf`;
  res.setHeader("Content-Type", contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  if (!body) {
    res.status(502).json({ error: "nfse_pdf_empty" });
    return;
  }
  const reader = body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch {
    if (!res.headersSent) {
      res.status(502).json({ error: "nfse_pdf_stream_error" });
    }
  }
}

export async function postEscritorioNfseRetryHandler(req: Request, res: Response): Promise<void> {
  const role = req.portalMembership?.role;
  const isOwner = req.authContext?.roles.includes("owner");
  if (role !== "admin_escritorio" && !isOwner) {
    res.status(403).json({ error: "portal_forbidden", message: "Apenas admin_escritorio." });
    return;
  }

  const chargeId = String(req.params.chargeId ?? "").trim();
  if (!isUuid(chargeId)) {
    res.status(400).json({ error: "invalid_request" });
    return;
  }
  const publicTenantId = await resolvePublicTenant(req, res);
  if (!publicTenantId) return;

  const status = await withTenantTransaction(publicTenantId, async (client) => {
    const nfse = await getNfseByCharge(client, chargeId, publicTenantId);
    return nfse?.status ?? null;
  });

  if (!status) {
    res.status(404).json({ error: "nfse_not_found" });
    return;
  }
  if (status !== "erro") {
    res.status(422).json({ error: "nfse_retry_invalid_status", message: "Retry apenas para status erro." });
    return;
  }

  await enqueueNfseEmitJob({ chargeId, tenantId: publicTenantId }, { delay: 0 });
  res.status(202).json({ accepted: true, charge_id: chargeId });
}

export async function postInboxNfseCallbackHandler(req: Request, res: Response): Promise<void> {
  const expected = process.env.WEBHOOK_NFSE_SECRET?.trim();
  if (expected) {
    const got = req.header("x-nfse-secret")?.trim();
    if (got !== expected) {
      res.status(401).json({ error: "invalid_nfse_webhook_secret" });
      return;
    }
  }

  const body = req.body ?? {};
  const referencia = typeof body.referencia === "string" ? body.referencia.trim() : "";
  if (!referencia) {
    res.status(400).json({ error: "invalid_body" });
    return;
  }

  const pool = getPool();
  const pre = await pool.query<{ tenant_id: string }>(
    `SELECT tenant_id FROM nfse_emissions
     WHERE external_ref = $1 OR charge_id::text = $1
     LIMIT 1`,
    [referencia]
  );
  const tenantId = pre.rows[0]?.tenant_id;
  if (!tenantId) {
    res.status(404).json({ error: "nfse_not_found" });
    return;
  }

  const { processNfseCallback } = await import("../../application/process-nfse-callback");
  await withTenantTransaction(tenantId, (client) =>
    processNfseCallback(client, {
      referencia,
      status: body.status ?? "erro",
      numero_nfse: body.numero_nfse,
      codigo_verificacao: body.codigo_verificacao,
      pdf_url: body.pdf_url,
      xml_url: body.xml_url,
      mensagem_erro: body.mensagem_erro
    })
  );

  res.status(200).json({ received: true });
}
