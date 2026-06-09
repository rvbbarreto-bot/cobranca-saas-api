import { getPool } from "../../../platform/persistence/pool";
import { isSerproMockEnabled } from "../../../platform/config/fiscal-serpro-enabled";
import {
  decryptSerproConsumerKey,
  decryptSerproConsumerSecret,
  getSerproConfigByOrganizationId
} from "../infrastructure/serpro-config-repository";
import { createSerproIntegraClient } from "../../serpro-integra-contador/infrastructure/serpro-integra-client";
import { getSerproAccessToken } from "../../serpro-integra-contador/infrastructure/serpro-oauth-token-cache";
import { serproBaseUrl } from "../../serpro-integra-contador/infrastructure/serpro-request-builder";
import type { SerproIntegraContadorClient } from "../../serpro-integra-contador/domain/serpro-types";

export type SerproRuntime = {
  useMock: boolean;
  client: SerproIntegraContadorClient;
  accessToken: string;
  contratanteCnpj: string;
};

export async function resolveSerproRuntimeForOrganization(input: {
  organizationId: string;
  fallbackContratanteCnpj?: string;
}): Promise<SerproRuntime> {
  const pool = getPool();
  const serproConfig = await getSerproConfigByOrganizationId(pool, input.organizationId);
  const useMock = isSerproMockEnabled() || !serproConfig?.serproEnabled;

  if (useMock) {
    return {
      useMock: true,
      client: createSerproIntegraClient(serproBaseUrl("demo"), true),
      accessToken: "mock-token",
      contratanteCnpj: serproConfig?.contratanteCnpj ?? input.fallbackContratanteCnpj ?? "00000000000191"
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
  const token = await getSerproAccessToken({
    cacheKey: `${input.organizationId}:${serproConfig.ambiente}`,
    tokenUrl: `${base}/oauth/token`,
    consumerKey,
    consumerSecret
  });
  return {
    useMock: false,
    client: createSerproIntegraClient(base, false),
    accessToken: token,
    contratanteCnpj: serproConfig.contratanteCnpj
  };
}
