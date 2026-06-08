import { getPool } from "../../../platform/persistence/pool";
import type { CanonicalApuracao } from "../../fiscal-ingestion/domain/canonical-apuracao.schema";
import { resolveSerproRuntimeForOrganization } from "../../fiscal-guias/application/resolve-serpro-runtime";
import { buildSerproConsultReciboRequest } from "../../serpro-integra-contador/infrastructure/serpro-request-builder";
import { buildMockSerproPdfBytes } from "../../serpro-integra-contador/domain/serpro-mock-payload";
import {
  getProcessamentoById,
  insertProcessamentoEvento,
  updateProcessamentoRecibo,
  updateProcessamentoStatus
} from "../infrastructure/processamento-fiscal-repository";
import { uploadFiscalReciboPdf } from "./upload-fiscal-recibo-pdf";
import { scheduleSerproEmitDasJob } from "../../../platform/jobs/enqueue-serpro-emit-das";

export type SerproReciboJobPayload = {
  processamentoId: string;
  automacaoTenantId: string;
};

export async function processSerproReciboJob(payload: SerproReciboJobPayload): Promise<void> {
  const pool = getPool();
  const proc = await getProcessamentoById(pool, payload.automacaoTenantId, payload.processamentoId);
  if (!proc) {
    throw new Error(`Processamento ${payload.processamentoId} nao encontrado.`);
  }
  if (proc.reciboStorageKey) {
    scheduleSerproEmitDasJob(payload);
    return;
  }
  if (proc.status !== "TRANSMITIDA") {
    return;
  }

  const client = await pool.connect();
  try {
    await insertProcessamentoEvento(client, proc.id, "recibo_iniciado", {});

    const canonical = proc.canonicalSnapshot as CanonicalApuracao;
    const runtime = await resolveSerproRuntimeForOrganization({
      organizationId: proc.organizationId,
      fallbackContratanteCnpj: canonical.cnpj
    });

    const req = buildSerproConsultReciboRequest({
      contratanteCnpj: runtime.contratanteCnpj,
      contribuinteCnpj: canonical.cnpj,
      competencia: canonical.competencia,
      protocolo: proc.protocoloSerpro ?? undefined
    });

    const res = await runtime.client.consultar(req, runtime.accessToken);
    if (!res.ok) {
      await updateProcessamentoStatus(client, proc.id, {
        status: "ERRO",
        erroCodigo: res.erroCodigo ?? "RECIBO_SERPRO_ERRO",
        erroDetalhe: { raw: res.rawBody }
      });
      await insertProcessamentoEvento(client, proc.id, "recibo_erro", { res });
      return;
    }

    const pdfBytes = res.pdfBytes ?? buildMockSerproPdfBytes("recibo");
    const uploaded = await uploadFiscalReciboPdf({
      tenantId: payload.automacaoTenantId,
      processamentoId: proc.id,
      pdfBytes
    });

    await updateProcessamentoRecibo(client, proc.id, uploaded.recibo_storage_key);
    await insertProcessamentoEvento(client, proc.id, "recibo_concluido", {
      recibo_storage_key: uploaded.recibo_storage_key
    });

    scheduleSerproEmitDasJob(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await updateProcessamentoStatus(client, proc.id, {
      status: "ERRO",
      erroCodigo: "RECIBO_FALHOU",
      erroDetalhe: { message }
    });
    await insertProcessamentoEvento(client, proc.id, "recibo_erro", { message });
  } finally {
    client.release();
  }
}
