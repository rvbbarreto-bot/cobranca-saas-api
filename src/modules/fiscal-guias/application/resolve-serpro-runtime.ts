import { getPool } from "../../../platform/persistence/pool";
import { isSerproMockEnabled } from "../../../platform/config/fiscal-serpro-enabled";
import { isSerproProcuracaoRequired } from "../../../platform/config/fiscal-serpro-procuracao";
import {
  decryptSerproConsumerKey,
  decryptSerproConsumerSecret,
  getSerproConfigByOrganizationId
} from "../infrastructure/serpro-config-repository";
import { createSerproIntegraClient } from "../../serpro-integra-contador/infrastructure/serpro-integra-client";
import { serproBaseUrl } from "../../serpro-integra-contador/infrastructure/serpro-request-builder";
import type { SerproIntegraContadorClient } from "../../serpro-integra-contador/domain/serpro-types";
import type { SerproAuthContext } from "../../serpro-integra-contador/domain/serpro-auth-context";
import {
  buildSerproAuthContext,
  obtainSerproProcuradorToken
} from "../../serpro-integra-contador/infrastructure/serpro-jwt-token-service";
import { parseIcpBrasilCertIdentity } from "../../serpro-integra-contador/infrastructure/serpro-cert-identity";
import { getSerproSapiTokens } from "../../serpro-integra-contador/infrastructure/serpro-sapi-auth";
import {
  getActiveCertificadoForCliente,
  getPortalClienteCnpj
} from "../infrastructure/certificado-digital-repository";
import { getOrganizationById } from "../../exeq-platform/infrastructure/organization-repository";

export type SerproRuntime = {
  useMock: boolean;
  client: SerproIntegraContadorClient;
  auth: SerproAuthContext;
  /** Compatibilidade com call sites legados. */
  accessToken: string;
  contratanteCnpj: string;
  /** CNPJ/CPF do autor do pedido (titular ou procurador). */
  autorPedidoDocumento?: string;
  baseUrl: string;
};

async function getPortalClienteNome(
  tenantId: string,
  portalClienteId: string
): Promise<string | null> {
  const pool = getPool();
  const r = await pool.query<{ nome: string }>(
    `SELECT nome FROM portal.cliente WHERE id = $2::uuid AND tenant_id = $1 LIMIT 1`,
    [tenantId, portalClienteId]
  );
  return r.rows[0]?.nome ?? null;
}

async function loadActiveCertificado(automacaoTenantId: string, portalClienteId: string) {
  try {
    return await getActiveCertificadoForCliente(automacaoTenantId, portalClienteId);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("unable to authenticate") || msg.includes("Unsupported state")) {
      throw new Error(
        "SERPRO_CERTIFICADO_DECRYPT_FAILED — ENCRYPTION_KEY atual nao decripta o A1 gravado. Regrave o certificado no portal ou alinhe ENCRYPTION_KEY."
      );
    }
    throw error;
  }
}

async function resolveLiveSerproAuth(input: {
  organizationId: string;
  automacaoTenantId: string;
  portalClienteId: string;
  contribuinteCnpj: string;
  baseUrl: string;
  contratanteCnpj: string;
  ambiente: "demo" | "prod";
  consumerKey: string;
  consumerSecret: string;
}): Promise<{
  accessToken: string;
  jwtToken: string;
  procuradorToken?: string;
  autorPedidoDocumento: string;
}> {
  const cert = await loadActiveCertificado(input.automacaoTenantId, input.portalClienteId);
  if (!cert) {
    throw new Error("SERPRO_CERTIFICADO_AUSENTE");
  }

  const contribuinteCnpj =
    input.contribuinteCnpj.replace(/\D/g, "") ||
    (await getPortalClienteCnpj(input.automacaoTenantId, input.portalClienteId))?.replace(/\D/g, "") ||
    "";
  if (!contribuinteCnpj) {
    throw new Error("SERPRO_CONTRIBUINTE_CNPJ_AUSENTE");
  }

  const org = await getOrganizationById(getPool(), input.organizationId);
  const clienteNome = await getPortalClienteNome(input.automacaoTenantId, input.portalClienteId);
  const certIdentity = parseIcpBrasilCertIdentity(cert.decrypted.certificadoPem);
  const contratanteDigits = input.contratanteCnpj.replace(/\D/g, "");
  const autorDocumento = certIdentity.documento;
  const autorNome = clienteNome ?? certIdentity.nome;
  const contratanteNome =
    contratanteDigits === certIdentity.documento
      ? autorNome
      : org?.name?.trim() || input.contratanteCnpj;

  const sapi = await getSerproSapiTokens({
    cacheKey: `${input.organizationId}:${input.ambiente}:sapi`,
    consumerKey: input.consumerKey,
    consumerSecret: input.consumerSecret,
    certificadoPem: cert.decrypted.certificadoPem,
    chavePrivadaPem: cert.decrypted.chavePrivadaPem
  });

  let procuradorToken: string | undefined;
  if (isSerproProcuracaoRequired()) {
    procuradorToken = await obtainSerproProcuradorToken({
      cacheKey: `${input.organizationId}:${input.portalClienteId}:${input.ambiente}:proc`,
      baseUrl: input.baseUrl,
      accessToken: sapi.accessToken,
      jwtToken: sapi.jwtToken,
      contratanteCnpj: input.contratanteCnpj,
      contratanteNome,
      contribuinteCnpj,
      autorDocumento,
      autorNome,
      autorTipo: certIdentity.documentoTipo,
      certificadoPem: cert.decrypted.certificadoPem,
      chavePrivadaPem: cert.decrypted.chavePrivadaPem,
      certificadoValidUntil: cert.valid_until
    });
  }

  return {
    accessToken: sapi.accessToken,
    jwtToken: sapi.jwtToken,
    procuradorToken,
    autorPedidoDocumento: autorDocumento
  };
}

export async function resolveSerproRuntimeForOrganization(input: {
  organizationId: string;
  fallbackContratanteCnpj?: string;
  automacaoTenantId?: string;
  portalClienteId?: string;
  contribuinteCnpj?: string;
}): Promise<SerproRuntime> {
  const pool = getPool();
  const serproConfig = await getSerproConfigByOrganizationId(pool, input.organizationId);
  const useMock = isSerproMockEnabled() || !serproConfig?.serproEnabled;

  if (useMock) {
    const auth = buildSerproAuthContext("mock-token");
    return {
      useMock: true,
      client: createSerproIntegraClient(serproBaseUrl("demo"), true),
      auth,
      accessToken: auth.accessToken,
      contratanteCnpj: serproConfig?.contratanteCnpj ?? input.fallbackContratanteCnpj ?? "00000000000191",
      baseUrl: serproBaseUrl("demo")
    };
  }

  if (!serproConfig) {
    throw new Error("SERPRO_CONFIG_AUSENTE");
  }
  const consumerKey = decryptSerproConsumerKey(serproConfig);
  const consumerSecret = decryptSerproConsumerSecret(serproConfig);
  if (!consumerKey || !consumerSecret) {
    throw new Error("SERPRO_CREDENCIAIS_INCOMPLETAS");
  }
  const base = serproBaseUrl(serproConfig.ambiente);

  if (!input.automacaoTenantId || !input.portalClienteId) {
    throw new Error("SERPRO_LIVE_REQUER_PORTAL_CLIENTE — informe automacaoTenantId e portalClienteId para auth SAPI.");
  }

  const liveAuth = await resolveLiveSerproAuth({
    organizationId: input.organizationId,
    automacaoTenantId: input.automacaoTenantId,
    portalClienteId: input.portalClienteId,
    contribuinteCnpj: input.contribuinteCnpj ?? input.fallbackContratanteCnpj ?? serproConfig.contratanteCnpj,
    baseUrl: base,
    contratanteCnpj: serproConfig.contratanteCnpj,
    ambiente: serproConfig.ambiente,
    consumerKey,
    consumerSecret
  });

  const auth = buildSerproAuthContext(
    liveAuth.accessToken,
    liveAuth.jwtToken,
    liveAuth.procuradorToken
  );

  return {
    useMock: false,
    client: createSerproIntegraClient(base, false),
    auth,
    accessToken: liveAuth.accessToken,
    contratanteCnpj: serproConfig.contratanteCnpj,
    autorPedidoDocumento: liveAuth.autorPedidoDocumento,
    baseUrl: base
  };
}
