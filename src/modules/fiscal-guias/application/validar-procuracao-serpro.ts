import { parsePortalClienteIdQuery } from "../domain/schemas/portal-cliente-query.schema";
import { portalClienteBelongsToTenant } from "../infrastructure/certificado-digital-repository";
import { writeFiscalAuditLog } from "../infrastructure/fiscal-audit.service";
import {
  getActiveProcuracaoForCliente,
  mapProcuracaoRowToResponse,
  updateProcuracaoMetadata
} from "../infrastructure/procuracao-repository";
import { getOrganizationByAutomacaoTenantId } from "../../exeq-platform/infrastructure/organization-repository";
import { getPool } from "../../../platform/persistence/pool";
import { resolveSerproRuntimeForOrganization } from "./resolve-serpro-runtime";
import { buildSerproObterProcuracaoRequest } from "../../serpro-integra-contador/infrastructure/serpro-request-builder";
import {
  parseSerproProcuracaoSituacao,
  serproProcuracaoUserMessage,
  type SerproProcuracaoSituacao
} from "../../serpro-integra-contador/domain/serpro-procuracao-situacao";

export async function validarProcuracaoSerproUseCase(input: {
  tenantId: string;
  portalClienteId: string;
  contribuinteCnpj: string;
  userId?: string;
}): Promise<
  | {
      ok: true;
      situacao: SerproProcuracaoSituacao;
      mensagem: string;
      procuracao: ReturnType<typeof mapProcuracaoRowToResponse>;
    }
  | { ok: false; kind: "validation_error"; issues: import("zod").ZodIssue[] }
  | { ok: false; kind: "cliente_not_found" }
  | { ok: false; kind: "procuracao_not_found" }
  | { ok: false; kind: "organization_not_found" }
> {
  const parsed = parsePortalClienteIdQuery({ portal_cliente_id: input.portalClienteId });
  if (!parsed.ok) {
    return { ok: false, kind: "validation_error", issues: parsed.issues };
  }

  const belongs = await portalClienteBelongsToTenant(input.tenantId, parsed.value.portal_cliente_id);
  if (!belongs) {
    return { ok: false, kind: "cliente_not_found" };
  }

  const procuracao = await getActiveProcuracaoForCliente(input.tenantId, parsed.value.portal_cliente_id);
  if (!procuracao) {
    return { ok: false, kind: "procuracao_not_found" };
  }

  const pool = getPool();
  const org = await getOrganizationByAutomacaoTenantId(pool, input.tenantId);
  if (!org) {
    return { ok: false, kind: "organization_not_found" };
  }

  const runtime = await resolveSerproRuntimeForOrganization({
    organizationId: org.id,
    fallbackContratanteCnpj: input.contribuinteCnpj,
    automacaoTenantId: input.tenantId,
    portalClienteId: parsed.value.portal_cliente_id,
    contribuinteCnpj: input.contribuinteCnpj
  });

  const req = buildSerproObterProcuracaoRequest({
    contratanteCnpj: runtime.contratanteCnpj,
    contribuinteCnpj: input.contribuinteCnpj,
    procuradorDocumento: procuracao.procurador_documento,
    autorPedidoDocumento: runtime.autorPedidoDocumento ?? procuracao.procurador_documento
  });

  const res = await runtime.client.consultar(req, runtime.auth);
  const situacao = res.ok ? parseSerproProcuracaoSituacao(res.rawBody) : "erro_serpro";
  const mensagem = serproProcuracaoUserMessage(situacao);
  const validatedAt = new Date().toISOString();

  const client = await pool.connect();
  try {
    const updated = await updateProcuracaoMetadata(client, procuracao.id, input.tenantId, {
      serpro_situacao: situacao,
      serpro_validated_at: validatedAt,
      serpro_raw: res.rawBody
    });
    if (!updated) {
      return { ok: false, kind: "procuracao_not_found" };
    }

    await writeFiscalAuditLog(
      {
        tenantId: input.tenantId,
        userId: input.userId,
        action: "procuracao_validada_serpro",
        resourceType: "procuracao",
        resourceId: procuracao.id,
        newValue: { situacao, mensagem, validated_at: validatedAt }
      },
      client
    );

    return {
      ok: true,
      situacao,
      mensagem,
      procuracao: mapProcuracaoRowToResponse(updated)
    };
  } finally {
    client.release();
  }
}

export function isProcuracaoSerproValid(metadata: Record<string, unknown>): boolean {
  return metadata.serpro_situacao === "valida";
}
