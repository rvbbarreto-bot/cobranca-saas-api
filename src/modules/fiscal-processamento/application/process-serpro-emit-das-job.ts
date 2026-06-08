import { getPool } from "../../../platform/persistence/pool";
import type { CanonicalApuracao } from "../../fiscal-ingestion/domain/canonical-apuracao.schema";
import { resolveSerproRuntimeForOrganization } from "../../fiscal-guias/application/resolve-serpro-runtime";
import { uploadFiscalGuiaPdf } from "../../fiscal-guias/application/upload-fiscal-guia-pdf";
import {
  applyGuiaFiscalDisponivel,
  insertGuiaFiscalProcessing
} from "../../fiscal-guias/infrastructure/guia-fiscal-repository";
import { buildSerproEmitDasRequest } from "../../serpro-integra-contador/infrastructure/serpro-request-builder";
import { extractSerproDasPayload, buildMockSerproPdfBytes } from "../../serpro-integra-contador/domain/serpro-mock-payload";
import {
  getProcessamentoById,
  insertProcessamentoEvento,
  updateProcessamentoGuiaLink,
  updateProcessamentoStatus
} from "../infrastructure/processamento-fiscal-repository";

export type SerproEmitDasJobPayload = {
  processamentoId: string;
  automacaoTenantId: string;
};

export async function processSerproEmitDasJob(payload: SerproEmitDasJobPayload): Promise<void> {
  const pool = getPool();
  const proc = await getProcessamentoById(pool, payload.automacaoTenantId, payload.processamentoId);
  if (!proc) {
    throw new Error(`Processamento ${payload.processamentoId} nao encontrado.`);
  }
  if (proc.status === "CONCLUIDO" && proc.guiaFiscalId) return;
  if (proc.status !== "RECIBO_OK" && proc.status !== "EMITINDO_DAS") {
    return;
  }

  const client = await pool.connect();
  try {
    await updateProcessamentoStatus(client, proc.id, { status: "EMITINDO_DAS" });
    await insertProcessamentoEvento(client, proc.id, "das_iniciado", {});

    const canonical = proc.canonicalSnapshot as CanonicalApuracao;
    const runtime = await resolveSerproRuntimeForOrganization({
      organizationId: proc.organizationId,
      fallbackContratanteCnpj: canonical.cnpj
    });

    const req = buildSerproEmitDasRequest({
      contratanteCnpj: runtime.contratanteCnpj,
      contribuinteCnpj: canonical.cnpj,
      competencia: canonical.competencia,
      valorDas: canonical.valorTotalDas
    });

    const res = await runtime.client.emitir(req, runtime.accessToken);
    if (!res.ok) {
      await updateProcessamentoStatus(client, proc.id, {
        status: "ERRO",
        erroCodigo: res.erroCodigo ?? "DAS_SERPRO_ERRO",
        erroDetalhe: { raw: res.rawBody }
      });
      await insertProcessamentoEvento(client, proc.id, "das_erro", { res });
      return;
    }

    const das = extractSerproDasPayload(res.rawBody);
    const valorPrincipal = das.valorPrincipal ?? canonical.valorTotalDas;
    const idempotencyKey = `serpro-das:${proc.id}`;

    const guia = await insertGuiaFiscalProcessing(client, {
      tenantId: payload.automacaoTenantId,
      portalClienteId: proc.portalClienteId,
      tipoGuia: "DAS",
      competencia: proc.competencia,
      idempotencyKey,
      captureJobId: `processamento:${proc.id}`
    });

    const pdfBytes = res.pdfBytes ?? buildMockSerproPdfBytes("das");
    const uploaded = await uploadFiscalGuiaPdf({
      tenantId: payload.automacaoTenantId,
      guiaId: guia.id,
      versao: 1,
      pdfBytes
    });

    const vencimento =
      das.dataVencimento ??
      new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    await applyGuiaFiscalDisponivel(client, guia.id, payload.automacaoTenantId, {
      valorPrincipal,
      valorMulta: das.valorMulta ?? 0,
      valorJuros: das.valorJuros ?? 0,
      dataVencimento: vencimento,
      linhaDigitavel:
        das.linhaDigitavel ?? "85800000000150012340201234567890123456789012345",
      complianceStatus: "aprovado",
      pdfUrl: uploaded.pdf_url,
      pdfStorageKey: uploaded.pdf_storage_key
    });

    await updateProcessamentoGuiaLink(client, proc.id, guia.id);
    await insertProcessamentoEvento(client, proc.id, "das_concluido", {
      guia_fiscal_id: guia.id
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await updateProcessamentoStatus(client, proc.id, {
      status: "ERRO",
      erroCodigo: "DAS_FALHOU",
      erroDetalhe: { message }
    });
    await insertProcessamentoEvento(client, proc.id, "das_erro", { message });
  } finally {
    client.release();
  }
}
