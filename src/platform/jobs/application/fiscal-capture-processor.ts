import { isFiscalCaptureStubEnabled } from "../../config/fiscal-capture-stub";
import { getPool } from "../../persistence/pool";
import { evaluateFiscalCompliance } from "../../../modules/fiscal-guias/application/evaluate-fiscal-compliance";
import { uploadFiscalGuiaPdf } from "../../../modules/fiscal-guias/application/upload-fiscal-guia-pdf";
import { canDisponibilizarGuia } from "../../../modules/fiscal-guias/domain/guia-fiscal-status-transition";
import type { ReceitaFiscalGateway } from "../../../modules/fiscal-guias/domain/receita-gateway.interface";
import type { TipoGuia } from "../../../modules/fiscal-guias/domain/schemas/guia-fiscal.schema";
import { writeFiscalAuditLog } from "../../../modules/fiscal-guias/infrastructure/fiscal-audit.service";
import {
  getActiveCertificadoForCliente,
  getPortalClienteCnpj
} from "../../../modules/fiscal-guias/infrastructure/certificado-digital-repository";
import {
  applyGuiaFiscalComplianceBlocked,
  applyGuiaFiscalDisponivel,
  applyGuiaFiscalStubDisponivel,
  findGuiaFiscalByIdempotency,
  insertGuiaFiscalProcessing,
  markGuiaFiscalCaptureFailed
} from "../../../modules/fiscal-guias/infrastructure/guia-fiscal-repository";
import { getActiveProcuracaoForCliente } from "../../../modules/fiscal-guias/infrastructure/procuracao-repository";
import { createReceitaFiscalGateway } from "../../../modules/fiscal-guias/infrastructure/receita/http-receita-fiscal-gateway";
import { enqueueGuiaDisponivelNotification } from "../enqueue-fiscal-guia-notification";

export type FiscalCaptureJobPayload = {
  publicTenantUuid: string;
  automacaoTenantId: string;
  portalClienteId: string;
  tipoGuia: TipoGuia;
  competencia: string;
  idempotencyKey: string;
  /** DARF — codigo receita Federal (ex.: 0561). Default env ou 0561. */
  codigoReceita?: string;
  /** DARF — data apuracao YYYY-MM-DD. Default: ultimo dia da competencia. */
  periodoApuracao?: string;
  correlationId?: string;
  n8nExecutionId?: string;
};

export type FiscalCaptureProcessorDeps = {
  receitaGateway?: ReceitaFiscalGateway | null;
  enqueueNotification?: typeof enqueueGuiaDisponivelNotification;
};

function defaultDarfCodigoReceita(): string {
  return process.env.FISCAL_DARF_CODIGO_RECEITA_DEFAULT?.trim() || "0561";
}

function defaultPeriodoApuracaoFromCompetencia(competencia: string): string {
  const [y, m] = competencia.split("-").map(Number);
  if (!y || !m) {
    return "2030-12-31";
  }
  const lastDay = new Date(y, m, 0).getDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

async function finalizeDisponivel(
  data: FiscalCaptureJobPayload,
  guiaId: string,
  enqueue: typeof enqueueGuiaDisponivelNotification
): Promise<void> {
  await enqueue({
    tenantId: data.automacaoTenantId,
    guiaId,
    portalClienteId: data.portalClienteId,
    eventType: "guia.disponivel"
  });
}

async function failCapture(
  guiaId: string,
  tenantId: string,
  reason: string,
  auditReason: string
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await markGuiaFiscalCaptureFailed(client, guiaId, tenantId, reason);
    await writeFiscalAuditLog(
      {
        tenantId,
        action: "capture_failed",
        resourceType: "guia_fiscal",
        resourceId: guiaId,
        newValue: { reason: auditReason }
      },
      client
    );
    await client.query("COMMIT");
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Persiste guia em PROCESSANDO; stub (FISCAL_CAPTURE_STUB) ou gateway Receita real (DAS/DARF).
 */
export async function processFiscalCaptureJob(
  data: FiscalCaptureJobPayload,
  deps: FiscalCaptureProcessorDeps = {}
): Promise<void> {
  if (
    !data.automacaoTenantId?.trim() ||
    !data.portalClienteId?.trim() ||
    !data.idempotencyKey?.trim()
  ) {
    throw new Error("Job fiscal-capture exige automacaoTenantId, portalClienteId e idempotencyKey.");
  }
  if (!data.competencia?.trim() || !data.tipoGuia?.trim()) {
    throw new Error("Job fiscal-capture exige competencia e tipoGuia.");
  }
  if (data.tipoGuia !== "DAS" && data.tipoGuia !== "DARF") {
    throw new Error(`tipoGuia nao suportado: ${data.tipoGuia}`);
  }

  const existing = await findGuiaFiscalByIdempotency(data.automacaoTenantId, data.idempotencyKey);
  if (existing) {
    return;
  }

  const enqueueNotification = deps.enqueueNotification ?? enqueueGuiaDisponivelNotification;
  const pool = getPool();
  const client = await pool.connect();
  let guiaId = "";

  try {
    await client.query("BEGIN");

    const guia = await insertGuiaFiscalProcessing(client, {
      tenantId: data.automacaoTenantId,
      portalClienteId: data.portalClienteId,
      tipoGuia: data.tipoGuia,
      competencia: data.competencia,
      idempotencyKey: data.idempotencyKey,
      captureJobId: data.n8nExecutionId ?? data.correlationId
    });
    guiaId = guia.id;

    await writeFiscalAuditLog(
      {
        tenantId: data.automacaoTenantId,
        action: "capture_requested",
        resourceType: "guia_fiscal",
        resourceId: guia.id,
        newValue: {
          tipo_guia: data.tipoGuia,
          competencia: data.competencia,
          portal_cliente_id: data.portalClienteId,
          idempotency_key: data.idempotencyKey
        }
      },
      client
    );

    if (isFiscalCaptureStubEnabled()) {
      const updated = await applyGuiaFiscalStubDisponivel(client, guia.id, data.automacaoTenantId);
      if (updated) {
        await writeFiscalAuditLog(
          {
            tenantId: data.automacaoTenantId,
            action: "guia_disponibilizada",
            resourceType: "guia_fiscal",
            resourceId: guia.id,
            newValue: { status: "DISPONIVEL", stub: true }
          },
          client
        );
      }
      await client.query("COMMIT");
      if (updated) {
        await finalizeDisponivel(data, guia.id, enqueueNotification);
      }
      return;
    }

    await client.query("COMMIT");
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const gateway =
    deps.receitaGateway !== undefined ? deps.receitaGateway : createReceitaFiscalGateway();
  if (!gateway) {
    await failCapture(
      guiaId,
      data.automacaoTenantId,
      "RECEITA_DAS_CAPTURE_URL nao configurada.",
      "receita_url_missing"
    );
    return;
  }

  const cert = await getActiveCertificadoForCliente(data.automacaoTenantId, data.portalClienteId);
  if (!cert) {
    await failCapture(guiaId, data.automacaoTenantId, "Certificado digital ativo ausente.", "certificado_ausente");
    return;
  }

  const cnpj = await getPortalClienteCnpj(data.automacaoTenantId, data.portalClienteId);
  if (!cnpj) {
    await failCapture(guiaId, data.automacaoTenantId, "Cliente portal sem CNPJ.", "cnpj_ausente");
    return;
  }

  const procuracao = await getActiveProcuracaoForCliente(data.automacaoTenantId, data.portalClienteId);

  let capture;
  try {
    if (data.tipoGuia === "DARF") {
      capture = await gateway.captureDarf({
        cnpj,
        competencia: data.competencia,
        codigoReceita: data.codigoReceita?.trim() || defaultDarfCodigoReceita(),
        periodoApuracao:
          data.periodoApuracao?.trim() || defaultPeriodoApuracaoFromCompetencia(data.competencia),
        certPem: cert.decrypted.certificadoPem,
        keyPem: cert.decrypted.chavePrivadaPem,
        procuradorDocumento: procuracao?.procurador_documento
      });
    } else {
      capture = await gateway.captureDas({
        cnpj,
        competencia: data.competencia,
        certPem: cert.decrypted.certificadoPem,
        keyPem: cert.decrypted.chavePrivadaPem,
        procuradorDocumento: procuracao?.procurador_documento
      });
    }
  } catch (error: unknown) {
    await failCapture(
      guiaId,
      data.automacaoTenantId,
      error instanceof Error ? error.message : String(error),
      "receita_gateway_error"
    );
    throw error;
  }

  const compliance = evaluateFiscalCompliance(capture);

  let pdfUrl: string | null = null;
  let pdfStorageKey: string | null = null;
  if (capture.pdfBytes && capture.pdfBytes.length > 0) {
    const uploaded = await uploadFiscalGuiaPdf({
      tenantId: data.automacaoTenantId,
      guiaId,
      versao: 1,
      pdfBytes: capture.pdfBytes
    });
    pdfUrl = uploaded.pdf_url;
    pdfStorageKey = uploaded.pdf_storage_key;
  }

  const client2 = await pool.connect();
  let disponibilizada = false;
  try {
    await client2.query("BEGIN");

    if (!compliance.canDisponibilizar || !canDisponibilizarGuia(compliance.status)) {
      await applyGuiaFiscalComplianceBlocked(
        client2,
        guiaId,
        data.automacaoTenantId,
        compliance.motivo ?? "Compliance bloqueou disponibilizacao."
      );
      await writeFiscalAuditLog(
        {
          tenantId: data.automacaoTenantId,
          action: "compliance_bloqueio",
          resourceType: "guia_fiscal",
          resourceId: guiaId,
          newValue: {
            compliance_status: compliance.status,
            compliance_motivo: compliance.motivo
          }
        },
        client2
      );
      await client2.query("COMMIT");
      return;
    }

    const updated = await applyGuiaFiscalDisponivel(client2, guiaId, data.automacaoTenantId, {
      valorPrincipal: capture.valorPrincipal,
      valorMulta: capture.valorMulta,
      valorJuros: capture.valorJuros,
      dataVencimento: capture.dataVencimento,
      linhaDigitavel: capture.linhaDigitavel,
      pixCopiaCola: capture.pixCopiaCola,
      complianceStatus: compliance.status,
      complianceMotivo: compliance.motivo,
      pdfUrl,
      pdfStorageKey
    });

    if (updated) {
      await writeFiscalAuditLog(
        {
          tenantId: data.automacaoTenantId,
          action: "guia_disponibilizada",
          resourceType: "guia_fiscal",
          resourceId: guiaId,
          newValue: {
            status: "DISPONIVEL",
            pdf_storage_key: pdfStorageKey,
            compliance_status: compliance.status
          }
        },
        client2
      );
      disponibilizada = true;
    }

    await client2.query("COMMIT");
  } catch (error: unknown) {
    await client2.query("ROLLBACK");
    throw error;
  } finally {
    client2.release();
  }

  if (disponibilizada) {
    await finalizeDisponivel(data, guiaId, enqueueNotification);
  }
}
