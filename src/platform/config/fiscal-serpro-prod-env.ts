import { validateEncryptionKeyForProduction } from "./encryption-key-policy";

export type FiscalSerproEnvSnapshot = {
  nodeEnv?: string;
  fiscalGuiasEnabled?: string;
  fiscalSerproEnabled?: string;
  fiscalSerproMock?: string;
  encryptionKey?: string;
};

function isTruthyFlag(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "true" || v === "1";
}

function isSerproMockExplicitlyTrue(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "true" || v === "1";
}

function isProductionNodeEnv(nodeEnv: string | undefined): boolean {
  return nodeEnv?.trim() === "production";
}

/** Issues bloqueantes para check:prod-env --strict com modulo fiscal/SERPRO. */
export function collectFiscalSerproProductionEnvIssues(env: FiscalSerproEnvSnapshot): string[] {
  const issues: string[] = [];
  const isProd = isProductionNodeEnv(env.nodeEnv);
  const fiscalGuias = isTruthyFlag(env.fiscalGuiasEnabled);
  const serproEnabled = isTruthyFlag(env.fiscalSerproEnabled);
  const serproMock = isSerproMockExplicitlyTrue(env.fiscalSerproMock);

  if (isProd && serproMock) {
    issues.push(
      "FISCAL_SERPRO_MOCK=true em producao — desligue mock e configure credenciais SERPRO por organizacao no portal"
    );
  }

  if (fiscalGuias || serproEnabled) {
    const enc = validateEncryptionKeyForProduction(env.encryptionKey);
    if (!enc.ok) {
      issues.push(`${enc.reason} (obrigatorio com FISCAL_GUIAS_ENABLED ou FISCAL_SERPRO_ENABLED)`);
    }
  }

  return issues;
}

/** Avisos nao bloqueantes (modo strict ainda passa). */
export function collectFiscalSerproProductionEnvWarnings(env: FiscalSerproEnvSnapshot): string[] {
  const warnings: string[] = [];
  const isProd = isProductionNodeEnv(env.nodeEnv);
  const fiscalGuias = isTruthyFlag(env.fiscalGuiasEnabled);
  const serproEnabled = isTruthyFlag(env.fiscalSerproEnabled);
  const serproMock = isSerproMockExplicitlyTrue(env.fiscalSerproMock);

  if (isProd && serproEnabled && !serproMock) {
    warnings.push(
      "FISCAL_SERPRO_ENABLED=true em producao: configure consumer key/secret por org em fiscal.serpro_config (portal Config Fiscal)"
    );
  }

  if (fiscalGuias && !serproEnabled) {
    warnings.push(
      "FISCAL_GUIAS_ENABLED=true sem FISCAL_SERPRO_ENABLED — processamento PGDASD/SERPRO permanece desligado na API"
    );
  }

  if (serproEnabled && !fiscalGuias) {
    warnings.push(
      "FISCAL_SERPRO_ENABLED=true sem FISCAL_GUIAS_ENABLED — rotas fiscais do portal podem retornar 404"
    );
  }

  return warnings;
}
