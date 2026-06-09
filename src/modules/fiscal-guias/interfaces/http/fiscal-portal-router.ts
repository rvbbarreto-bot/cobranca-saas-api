import { Router } from "express";
import type { Request, Response } from "express";
import multer from "multer";
import { isFiscalSerproEnabled } from "../../../../platform/config/fiscal-serpro-enabled";
import { fiscalCsvIngestRateLimit } from "../../../../platform/http/middleware/rate-limit.middleware";
import { asyncHandler } from "../../../../platform/http/async-handler";
import { FiscalGuiasSchemaMigrationError } from "../../infrastructure/fiscal-schema";
import { getPortalCertificadoDigitalUseCase } from "../../application/get-portal-certificado-digital";
import { getPortalProcuracaoUseCase } from "../../application/get-portal-procuracao";
import { listPortalGuiasFiscaisUseCase } from "../../application/list-portal-guias-fiscais";
import { getPortalGuiaFiscalUseCase } from "../../application/get-portal-guia-fiscal";
import { postPortalCertificadoDigitalUseCase } from "../../application/post-portal-certificado-digital";
import { postPortalProcuracaoUseCase } from "../../application/post-portal-procuracao";
import { getPortalGuiaFiscalPdfUrlUseCase } from "../../application/get-portal-guia-fiscal-pdf-url";
import { postPortalGuiaPagamentoUseCase } from "../../application/post-portal-guia-pagamento";
import { getPool } from "../../../../platform/persistence/pool";
import {
  getPortalSerproConfigUseCase,
  patchPortalSerproConfigUseCase
} from "../../application/portal-serpro-config";
import {
  getPortalIngestStatusUseCase,
  mapIngestPublic,
  postPortalIngestCsvUseCase
} from "../../../fiscal-ingestion/application/portal-fiscal-ingest";
import {
  createProcessamentosFromIngestUseCase,
  mapProcessamentoPublic
} from "../../../fiscal-processamento/application/create-processamentos-from-ingest";
import {
  getPortalProcessamentoDetailUseCase,
  listPortalProcessamentosUseCase
} from "../../../fiscal-processamento/application/portal-processamentos-read";
import { getPortalProcessamentoReciboUrlUseCase } from "../../../fiscal-processamento/application/get-portal-processamento-recibo-url";
import { listPortalExpiringCertificatesUseCase } from "../../application/list-portal-expiring-certificates";
import { validarProcuracaoSerproUseCase } from "../../application/validar-procuracao-serpro";
import { getPortalClienteCnpj } from "../../infrastructure/certificado-digital-repository";
import { listPortalFiscalAuditUseCase } from "../../application/list-portal-fiscal-audit";

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 }
});

function isEscritorioStaff(req: Request): boolean {
  const role = req.portalMembership?.role;
  return role === "admin_escritorio" || role === "operador";
}

function isAdminEscritorio(req: Request): boolean {
  return req.portalMembership?.role === "admin_escritorio";
}

function respondFiscalSchemaError(res: Response, error: unknown): boolean {
  if (error instanceof FiscalGuiasSchemaMigrationError) {
    res.status(503).json({
      error: "schema_migration_required",
      message: error.message,
      migration: error.migrationFile
    });
    return true;
  }
  return false;
}

async function listGuiasFiscaisHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem listar guias fiscais."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  try {
    const result = await listPortalGuiasFiscaisUseCase({
      tenantId,
      query: req.query as Record<string, unknown>
    });

    if (!result.ok) {
      if (result.kind === "invalid_cursor") {
        res.status(400).json({ error: "invalid_cursor", message: "Parametro cursor invalido." });
        return;
      }
      res.status(422).json({ error: "validation_error", issues: result.issues });
      return;
    }

    res.json({
      guias: result.guias,
      count: result.count,
      page_limit: result.page_limit,
      next_cursor: result.next_cursor
    });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function getGuiaFiscalHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem consultar guias fiscais."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  const guiaId = req.params.guiaId?.trim();
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }
  if (!guiaId || !UUID_RE.test(guiaId)) {
    res.status(400).json({ error: "invalid_guia_id", message: "guiaId UUID invalido." });
    return;
  }

  try {
    const result = await getPortalGuiaFiscalUseCase(tenantId, guiaId);
    if (!result.ok) {
      res.status(404).json({ error: "guia_not_found", message: "Guia fiscal nao encontrada." });
      return;
    }
    res.json({ guia: result.guia });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function getCertificadoDigitalHttp(req: Request, res: Response): Promise<void> {
  if (!isAdminEscritorio(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio pode consultar certificado digital."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  const portalClienteId =
    typeof req.query.portal_cliente_id === "string" ? req.query.portal_cliente_id.trim() : "";

  try {
    const result = await getPortalCertificadoDigitalUseCase({ tenantId, portalClienteId });

    if (!result.ok) {
      if (result.kind === "cliente_not_found") {
        res.status(404).json({ error: "cliente_not_found", message: "Cliente portal nao encontrado." });
        return;
      }
      res.status(422).json({ error: "validation_error", issues: result.issues });
      return;
    }

    res.json({ certificado: result.certificado });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function getProcuracaoHttp(req: Request, res: Response): Promise<void> {
  if (!isAdminEscritorio(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio pode consultar procuracao."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  const portalClienteId =
    typeof req.query.portal_cliente_id === "string" ? req.query.portal_cliente_id.trim() : "";

  try {
    const result = await getPortalProcuracaoUseCase({ tenantId, portalClienteId });

    if (!result.ok) {
      if (result.kind === "cliente_not_found") {
        res.status(404).json({ error: "cliente_not_found", message: "Cliente portal nao encontrado." });
        return;
      }
      res.status(422).json({ error: "validation_error", issues: result.issues });
      return;
    }

    res.json({ procuracao: result.procuracao });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function postCertificadoDigitalHttp(req: Request, res: Response): Promise<void> {
  if (!isAdminEscritorio(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio pode cadastrar certificado digital."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  try {
    const result = await postPortalCertificadoDigitalUseCase({
      tenantId,
      body: req.body,
      uploadedByUserId: req.authContext?.userId
    });

    if (!result.ok) {
      if (result.kind === "cliente_not_found") {
        res.status(404).json({ error: "cliente_not_found", message: "Cliente portal nao encontrado." });
        return;
      }
      res.status(422).json({ error: "validation_error", issues: result.issues });
      return;
    }

    res.status(201).json({ certificado: result.certificado });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function postProcuracaoHttp(req: Request, res: Response): Promise<void> {
  if (!isAdminEscritorio(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio pode cadastrar procuracao."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  try {
    const result = await postPortalProcuracaoUseCase({
      tenantId,
      body: req.body,
      userId: req.authContext?.userId
    });

    if (!result.ok) {
      if (result.kind === "cliente_not_found") {
        res.status(404).json({ error: "cliente_not_found", message: "Cliente portal nao encontrado." });
        return;
      }
      res.status(422).json({ error: "validation_error", issues: result.issues });
      return;
    }

    res.status(201).json({ procuracao: result.procuracao });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function getGuiaFiscalPdfUrlHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem baixar PDF da guia."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  const guiaId = req.params.guiaId?.trim();
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }
  if (!guiaId || !UUID_RE.test(guiaId)) {
    res.status(400).json({ error: "invalid_guia_id", message: "guiaId UUID invalido." });
    return;
  }

  try {
    const result = await getPortalGuiaFiscalPdfUrlUseCase(tenantId, guiaId, {
      userId: req.authContext?.userId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined
    });

    if (!result.ok) {
      if (result.kind === "not_found") {
        res.status(404).json({ error: "guia_not_found", message: "Guia fiscal nao encontrada." });
        return;
      }
      res.status(404).json({ error: "pdf_unavailable", message: "PDF da guia ainda nao disponivel." });
      return;
    }

    res.json({ pdf_url: result.pdf_url, expires_in_seconds: result.expires_in_seconds });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function postGuiaPagamentoHttp(req: Request, res: Response): Promise<void> {
  if (!isAdminEscritorio(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio pode registrar pagamento de guia."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  const guiaId = req.params.guiaId?.trim();
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }
  if (!guiaId || !UUID_RE.test(guiaId)) {
    res.status(400).json({ error: "invalid_guia_id", message: "guiaId UUID invalido." });
    return;
  }

  try {
    const result = await postPortalGuiaPagamentoUseCase({
      tenantId,
      guiaId,
      body: req.body,
      userId: req.authContext?.userId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined
    });

    if (!result.ok) {
      if (result.kind === "not_found") {
        res.status(404).json({ error: "guia_not_found", message: "Guia fiscal nao encontrada." });
        return;
      }
      if (result.kind === "transition_denied") {
        res.status(409).json({ error: "guia_transition_denied", message: result.message });
        return;
      }
      res.status(422).json({ error: "validation_error", issues: result.issues });
      return;
    }

    res.status(201).json({ pagamento: result.pagamento, guia_status: result.guia_status });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function getSerproConfigHttp(req: Request, res: Response): Promise<void> {
  if (!isAdminEscritorio(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio pode consultar config SERPRO."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  try {
    const pool = getPool();
    const result = await getPortalSerproConfigUseCase(pool, tenantId);
    if (!result.ok) {
      res.status(404).json({
        error: "organization_not_found",
        message: "Organizacao nao vinculada ao escritorio. Execute backfill organization."
      });
      return;
    }
    res.json({ serpro_config: result.config });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function patchSerproConfigHttp(req: Request, res: Response): Promise<void> {
  if (!isAdminEscritorio(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio pode alterar config SERPRO."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  try {
    const pool = getPool();
    const result = await patchPortalSerproConfigUseCase(pool, tenantId, req.body);
    if (!result.ok) {
      if (result.kind === "validation_error") {
        res.status(422).json({ error: "validation_error", issues: result.issues });
        return;
      }
      if (result.kind === "invalid_cnpj") {
        res.status(422).json({ error: "invalid_cnpj", message: "CNPJ contratante invalido (14 digitos)." });
        return;
      }
      res.status(404).json({
        error: "organization_not_found",
        message: "Organizacao nao vinculada ao escritorio."
      });
      return;
    }
    res.json({ serpro_config: result.config });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function postIngestCsvHttp(req: Request, res: Response): Promise<void> {
  if (!isAdminEscritorio(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio pode enviar CSV PGDASD."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  const file = req.file;
  if (!file?.buffer?.length) {
    res.status(400).json({ error: "invalid_body", message: "Campo multipart 'file' obrigatorio." });
    return;
  }

  try {
    const result = await postPortalIngestCsvUseCase({
      automacaoTenantId: tenantId,
      uploadedByUserId: req.authContext?.userId,
      originalFilename: file.originalname,
      rawContent: file.buffer.toString("utf8")
    });

    if (!result.ok) {
      if (result.kind === "empty_file") {
        res.status(400).json({ error: "empty_file", message: "Arquivo CSV vazio." });
        return;
      }
      res.status(404).json({
        error: "organization_not_found",
        message: "Organizacao nao vinculada. Execute backfill organization."
      });
      return;
    }

    res.status(202).json({ ingest: mapIngestPublic(result.ingest) });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function getIngestStatusHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem consultar ingestao."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  const ingestId = typeof req.params.ingestId === "string" ? req.params.ingestId.trim() : "";
  if (!tenantId || !ingestId) {
    res.status(400).json({ error: "invalid_param", message: "ingestId obrigatorio." });
    return;
  }

  try {
    const result = await getPortalIngestStatusUseCase(tenantId, ingestId);
    if (!result.ok) {
      res.status(404).json({ error: "not_found", message: "Ingestao nao encontrada." });
      return;
    }
    res.json({ ingest: mapIngestPublic(result.ingest) });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function postProcessamentosHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem criar processamentos."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(400).json({ error: "invalid_tenant", message: "Tenant obrigatorio." });
    return;
  }

  const body = req.body as { fiscal_ingest_id?: string };
  const fiscalIngestId =
    typeof body.fiscal_ingest_id === "string" ? body.fiscal_ingest_id.trim() : "";
  if (!fiscalIngestId) {
    res.status(400).json({
      error: "invalid_body",
      message: "fiscal_ingest_id obrigatorio."
    });
    return;
  }

  if (!isFiscalSerproEnabled()) {
    res.status(503).json({
      error: "fiscal_serpro_disabled",
      message:
        "Transmissoes SERPRO temporariamente desabilitadas. Ingestao e consultas permanecem disponiveis."
    });
    return;
  }

  try {
    const result = await createProcessamentosFromIngestUseCase({
      automacaoTenantId: tenantId,
      fiscalIngestId
    });
    if (!result.ok) {
      if (result.kind === "ingest_not_found") {
        res.status(404).json({ error: "not_found", message: "Ingestao nao encontrada." });
        return;
      }
      if (result.kind === "ingest_not_validado") {
        res.status(409).json({
          error: "ingest_not_validated",
          message: "Ingestao ainda nao validada (status deve ser VALIDADO)."
        });
        return;
      }
      res.status(404).json({
        error: "organization_not_found",
        message: "Organizacao nao vinculada."
      });
      return;
    }

    res.status(201).json({
      processamentos: result.processamentos.map(mapProcessamentoPublic)
    });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function listProcessamentosHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem listar processamentos."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(400).json({ error: "invalid_tenant", message: "Tenant obrigatorio." });
    return;
  }

  try {
    const rows = await listPortalProcessamentosUseCase(tenantId);
    res.json({ processamentos: rows.map(mapProcessamentoPublic) });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function getProcessamentoHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem consultar processamento."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  const processamentoId =
    typeof req.params.processamentoId === "string" ? req.params.processamentoId.trim() : "";
  if (!tenantId || !processamentoId) {
    res.status(400).json({ error: "invalid_param", message: "processamentoId obrigatorio." });
    return;
  }

  try {
    const result = await getPortalProcessamentoDetailUseCase(tenantId, processamentoId);
    if (!result.ok) {
      res.status(404).json({ error: "not_found", message: "Processamento nao encontrado." });
      return;
    }
    res.json({
      processamento: mapProcessamentoPublic(result.processamento),
      eventos: result.eventos.map((e) => ({
        id: e.id,
        evento: e.evento,
        payload: e.payload,
        created_at: e.createdAt
      }))
    });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

async function listExpiringCertificatesHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem consultar certificados."
    });
    return;
  }
  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }
  try {
    const certificados = await listPortalExpiringCertificatesUseCase(tenantId);
    res.json({ certificados, count: certificados.length });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) return;
    throw error;
  }
}

async function postValidarProcuracaoSerproHttp(req: Request, res: Response): Promise<void> {
  if (!isAdminEscritorio(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio pode validar procuracao na SERPRO."
    });
    return;
  }
  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }
  const body = req.body as { portal_cliente_id?: string; contribuinte_cnpj?: string };
  const portalClienteId =
    typeof body.portal_cliente_id === "string" ? body.portal_cliente_id.trim() : "";
  if (!portalClienteId) {
    res.status(400).json({ error: "invalid_body", message: "portal_cliente_id obrigatorio." });
    return;
  }
  let contribuinteCnpj =
    typeof body.contribuinte_cnpj === "string" ? body.contribuinte_cnpj.replace(/\D/g, "") : "";
  if (!contribuinteCnpj) {
    contribuinteCnpj = (await getPortalClienteCnpj(tenantId, portalClienteId)) ?? "";
  }
  if (!contribuinteCnpj) {
    res.status(400).json({ error: "cnpj_ausente", message: "Cliente sem CNPJ cadastrado." });
    return;
  }
  try {
    const result = await validarProcuracaoSerproUseCase({
      tenantId,
      portalClienteId,
      contribuinteCnpj,
      userId: req.authContext?.userId
    });
    if (!result.ok) {
      if (result.kind === "procuracao_not_found") {
        res.status(404).json({ error: "procuracao_not_found", message: "Procuracao ativa nao encontrada." });
        return;
      }
      if (result.kind === "cliente_not_found") {
        res.status(404).json({ error: "cliente_not_found", message: "Cliente portal nao encontrado." });
        return;
      }
      if (result.kind === "organization_not_found") {
        res.status(404).json({ error: "organization_not_found", message: "Organizacao nao vinculada." });
        return;
      }
      res.status(422).json({ error: "validation_error", issues: result.issues });
      return;
    }
    res.json({
      situacao: result.situacao,
      mensagem: result.mensagem,
      procuracao: result.procuracao
    });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) return;
    throw error;
  }
}

async function getProcessamentoReciboUrlHttp(req: Request, res: Response): Promise<void> {
  if (!isEscritorioStaff(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio ou operador podem baixar recibo."
    });
    return;
  }
  const tenantId = req.tenantContext?.tenantId;
  const processamentoId =
    typeof req.params.processamentoId === "string" ? req.params.processamentoId.trim() : "";
  if (!tenantId || !processamentoId || !UUID_RE.test(processamentoId)) {
    res.status(400).json({ error: "invalid_param", message: "processamentoId UUID invalido." });
    return;
  }
  try {
    const result = await getPortalProcessamentoReciboUrlUseCase(tenantId, processamentoId, {
      userId: req.authContext?.userId,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") ?? undefined
    });
    if (!result.ok) {
      if (result.kind === "not_found") {
        res.status(404).json({ error: "not_found", message: "Processamento nao encontrado." });
        return;
      }
      res.status(409).json({ error: "recibo_unavailable", message: "Recibo ainda nao disponivel." });
      return;
    }
    res.json({ pdf_url: result.pdf_url, expires_in_seconds: result.expires_in_seconds });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) return;
    throw error;
  }
}

async function listFiscalAuditHttp(req: Request, res: Response): Promise<void> {
  if (!isAdminEscritorio(req)) {
    res.status(403).json({
      error: "portal_forbidden",
      message: "Apenas admin_escritorio pode consultar auditoria fiscal."
    });
    return;
  }

  const tenantId = req.tenantContext?.tenantId;
  if (!tenantId) {
    res.status(500).json({ error: "internal_error", message: "Tenant portal ausente." });
    return;
  }

  try {
    const pool = getPool();
    const result = await listPortalFiscalAuditUseCase(pool, tenantId, req.query as Record<string, unknown>);
    if (!result.ok) {
      if (result.kind === "invalid_cursor") {
        res.status(400).json({ error: "invalid_cursor", message: "Cursor de paginação inválido." });
        return;
      }
      res.status(400).json({
        error: "validation_error",
        message: "Parâmetros de consulta inválidos.",
        issues: result.issues
      });
      return;
    }
    res.json({
      entries: result.entries,
      count: result.count,
      page_limit: result.page_limit,
      next_cursor: result.next_cursor
    });
  } catch (error: unknown) {
    if (respondFiscalSchemaError(res, error)) {
      return;
    }
    throw error;
  }
}

/**
 * Rotas portal fiscal — montadas em `/v1/portal/fiscal` quando FISCAL_GUIAS_ENABLED=true.
 * Middlewares portal (tenant, JWT, membership) aplicados pelo router pai.
 */
export function createFiscalPortalRouter(): Router {
  const router = Router();
  router.get("/guias", asyncHandler(listGuiasFiscaisHttp));
  router.get("/guias/:guiaId", asyncHandler(getGuiaFiscalHttp));
  router.get("/guias/:guiaId/pdf-url", asyncHandler(getGuiaFiscalPdfUrlHttp));
  router.post("/guias/:guiaId/pagamentos", asyncHandler(postGuiaPagamentoHttp));
  router.get("/certificados/expiring", asyncHandler(listExpiringCertificatesHttp));
  router.get("/certificados", asyncHandler(getCertificadoDigitalHttp));
  router.post("/certificados", asyncHandler(postCertificadoDigitalHttp));
  router.get("/procuracoes", asyncHandler(getProcuracaoHttp));
  router.post("/procuracoes/validar-serpro", asyncHandler(postValidarProcuracaoSerproHttp));
  router.post("/procuracoes", asyncHandler(postProcuracaoHttp));
  router.get("/serpro-config", asyncHandler(getSerproConfigHttp));
  router.patch("/serpro-config", asyncHandler(patchSerproConfigHttp));
  router.post("/ingest/csv", fiscalCsvIngestRateLimit, csvUpload.single("file"), asyncHandler(postIngestCsvHttp));
  router.get("/ingest/:ingestId", asyncHandler(getIngestStatusHttp));
  router.post("/processamentos", asyncHandler(postProcessamentosHttp));
  router.get("/processamentos", asyncHandler(listProcessamentosHttp));
  router.get("/processamentos/:processamentoId/recibo/url", asyncHandler(getProcessamentoReciboUrlHttp));
  router.get("/processamentos/:processamentoId", asyncHandler(getProcessamentoHttp));
  router.get("/audit", asyncHandler(listFiscalAuditHttp));
  return router;
}
