import type { PoolClient } from "pg";
import { getPool } from "../../../platform/persistence/pool";
import { isSerproProcuracaoRequired } from "../../../platform/config/fiscal-serpro-procuracao";
import type { CanonicalApuracao } from "../../fiscal-ingestion/domain/canonical-apuracao.schema";
import { getActiveProcuracaoForCliente } from "../../fiscal-guias/infrastructure/procuracao-repository";
import { isProcuracaoSerproValid } from "../../fiscal-guias/application/validar-procuracao-serpro";
import { serproProcuracaoUserMessage } from "../../serpro-integra-contador/domain/serpro-procuracao-situacao";
import { resolveSerproRuntimeForOrganization } from "../../fiscal-guias/application/resolve-serpro-runtime";
import { buildSerproPgdasdTransmitRequest } from "../../serpro-integra-contador/infrastructure/serpro-request-builder";
import { serproPgdasdTransmissaoOptionsFromEnv } from "../../../platform/config/fiscal-serpro-pgdasd";
import {
  getProcessamentoById,
  insertProcessamentoEvento,
  updateProcessamentoStatus
} from "../infrastructure/processamento-fiscal-repository";
import { scheduleSerproReciboJob } from "../../../platform/jobs/enqueue-serpro-recibo";
import { writeProcessamentoApuracaoAudit } from "./write-processamento-apuracao-audit";

async function auditTransmitida(
  client: PoolClient,
  proc: { id: string; automacaoTenantId: string; correlationId: string | null },
  payload: Record<string, unknown>
): Promise<void> {
  await writeProcessamentoApuracaoAudit(client, {
    tenantId: proc.automacaoTenantId,
    processamentoId: proc.id,
    action: "transmitida",
    correlationId: proc.correlationId,
    payload
  });
}

async function auditErroSerpro(
  client: PoolClient,
  proc: { id: string; automacaoTenantId: string; correlationId: string | null },
  payload: Record<string, unknown>
): Promise<void> {
  await writeProcessamentoApuracaoAudit(client, {
    tenantId: proc.automacaoTenantId,
    processamentoId: proc.id,
    action: "erro_serpro",
    correlationId: proc.correlationId,
    payload
  });
}

export type SerproTransmitJobPayload = {
  processamentoId: string;
  automacaoTenantId: string;
};

export async function processSerproTransmitJob(payload: SerproTransmitJobPayload): Promise<void> {
  const pool = getPool();
  const proc = await getProcessamentoById(pool, payload.automacaoTenantId, payload.processamentoId);
  if (!proc) {
    throw new Error(`Processamento ${payload.processamentoId} nao encontrado.`);
  }
  if (proc.status !== "VALIDADO" && proc.status !== "TRANSMITINDO") {
    return;
  }

  const client = await pool.connect();
  try {
    if (isSerproProcuracaoRequired()) {
      const procuracao = await getActiveProcuracaoForCliente(
        payload.automacaoTenantId,
        proc.portalClienteId
      );
      if (!procuracao) {
        await updateProcessamentoStatus(client, proc.id, {
          status: "ERRO",
          erroCodigo: "PROCURACAO_AUSENTE",
          erroDetalhe: { mensagem: serproProcuracaoUserMessage("nao_validada") }
        });
        await insertProcessamentoEvento(client, proc.id, "transmissao_bloqueada", {
          motivo: "procuracao_ausente"
        });
        await auditErroSerpro(client, proc, {
          erro_codigo: "PROCURACAO_AUSENTE",
          motivo: "procuracao_ausente"
        });
        return;
      }
      if (!isProcuracaoSerproValid(procuracao.metadata)) {
        const situacao =
          typeof procuracao.metadata.serpro_situacao === "string"
            ? procuracao.metadata.serpro_situacao
            : "nao_validada";
        await updateProcessamentoStatus(client, proc.id, {
          status: "ERRO",
          erroCodigo: "PROCURACAO_INVALIDA",
          erroDetalhe: {
            mensagem: serproProcuracaoUserMessage(situacao as "nao_validada"),
            serpro_situacao: situacao
          }
        });
        await insertProcessamentoEvento(client, proc.id, "transmissao_bloqueada", {
          motivo: "procuracao_invalida",
          serpro_situacao: situacao
        });
        await auditErroSerpro(client, proc, {
          erro_codigo: "PROCURACAO_INVALIDA",
          serpro_situacao: situacao
        });
        return;
      }
    }

    await updateProcessamentoStatus(client, proc.id, { status: "TRANSMITINDO" });
    await insertProcessamentoEvento(client, proc.id, "transmissao_iniciada", {});

    const canonical = proc.canonicalSnapshot as CanonicalApuracao;
    const runtime = await resolveSerproRuntimeForOrganization({
      organizationId: proc.organizationId,
      fallbackContratanteCnpj: canonical.cnpj,
      automacaoTenantId: payload.automacaoTenantId,
      portalClienteId: proc.portalClienteId,
      contribuinteCnpj: canonical.cnpj
    });

    const req = buildSerproPgdasdTransmitRequest({
      contratanteCnpj: runtime.contratanteCnpj,
      contribuinteCnpj: canonical.cnpj,
      autorPedidoDocumento: runtime.autorPedidoDocumento ?? canonical.cnpj,
      apuracao: canonical,
      pgdasdOptions: serproPgdasdTransmissaoOptionsFromEnv()
    });

    const res = await runtime.client.declarar(req, runtime.auth);
    if (!res.ok) {
      await updateProcessamentoStatus(client, proc.id, {
        status: "ERRO",
        erroCodigo: res.erroCodigo ?? "SERPRO_ERRO",
        erroDetalhe: { raw: res.rawBody }
      });
      await insertProcessamentoEvento(client, proc.id, "transmissao_erro", { res });
      await auditErroSerpro(client, proc, {
        erro_codigo: res.erroCodigo ?? "SERPRO_ERRO"
      });
      return;
    }

    await updateProcessamentoStatus(client, proc.id, {
      status: "TRANSMITIDA",
      protocoloSerpro: res.protocolo ?? null
    });
    await insertProcessamentoEvento(client, proc.id, "transmissao_concluida", {
      protocolo: res.protocolo
    });
    await auditTransmitida(client, proc, {
      protocolo_serpro: res.protocolo ?? null
    });

    scheduleSerproReciboJob(payload);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const erroCodigo = message.includes("SERPRO_CERTIFICADO_DECRYPT_FAILED")
      ? "SERPRO_CERTIFICADO_DECRYPT_FAILED"
      : message.startsWith("SERPRO_")
        ? message.split(" ")[0]!
        : "TRANSMISSAO_FALHOU";
    await updateProcessamentoStatus(client, proc.id, {
      status: "ERRO",
      erroCodigo,
      erroDetalhe: { message }
    });
    await insertProcessamentoEvento(client, proc.id, "transmissao_erro", { message });
    await auditErroSerpro(client, proc, {
      erro_codigo: "TRANSMISSAO_FALHOU",
      message
    });
  } finally {
    client.release();
  }
}
