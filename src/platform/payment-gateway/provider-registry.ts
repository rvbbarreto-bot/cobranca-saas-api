export type GatewayCredentialField = {
  key: string;
  label: string;
  secret: boolean;
  required: boolean;
};

export type GatewayProviderMeta = {
  id: string;
  label: string;
  enabled: boolean;
  authType: "api_key" | "mtls_oauth" | "oauth_basic";
  credentialFields: GatewayCredentialField[];
  supportsBoleto: boolean;
  supportsPix: boolean;
};

function envEnabled(flagName: string, defaultEnabled = true): boolean {
  const raw = process.env[flagName]?.trim().toLowerCase();
  if (raw === "false" || raw === "0") return false;
  if (raw === "true" || raw === "1") return true;
  return defaultEnabled;
}

export const GATEWAY_REGISTRY: Record<string, GatewayProviderMeta> = {
  asaas: {
    id: "asaas",
    label: "Asaas",
    enabled: true,
    authType: "api_key",
    credentialFields: [{ key: "api_key", label: "API Key", secret: true, required: true }],
    supportsBoleto: true,
    supportsPix: true
  },
  inter: {
    id: "inter",
    label: "Banco Inter",
    enabled: envEnabled("GATEWAY_INTER_ENABLED", true),
    authType: "mtls_oauth",
    credentialFields: [
      { key: "client_id", label: "Client ID", secret: false, required: true },
      { key: "client_secret", label: "Client Secret", secret: true, required: true },
      { key: "certificate_pem", label: "Certificado PEM", secret: true, required: true },
      { key: "private_key_pem", label: "Chave privada PEM", secret: true, required: true }
    ],
    supportsBoleto: true,
    supportsPix: false
  },
  cora: {
    id: "cora",
    label: "Cora",
    enabled: envEnabled("GATEWAY_CORA_ENABLED", true),
    authType: "mtls_oauth",
    credentialFields: [
      { key: "client_id", label: "Client ID", secret: false, required: true },
      { key: "certificate_pem", label: "Certificado PEM", secret: true, required: true },
      { key: "private_key_pem", label: "Chave privada PEM", secret: true, required: true }
    ],
    supportsBoleto: true,
    supportsPix: true
  },
  bb: {
    id: "bb",
    label: "Banco do Brasil",
    enabled: envEnabled("GATEWAY_BB_ENABLED", false),
    authType: "oauth_basic",
    credentialFields: [
      { key: "client_id", label: "Client ID", secret: false, required: true },
      { key: "client_secret", label: "Client Secret", secret: true, required: true },
      { key: "gw_app_key", label: "gw-app-key", secret: true, required: true },
      { key: "numero_convenio", label: "Número convênio", secret: false, required: true },
      { key: "numero_carteira", label: "Carteira", secret: false, required: true },
      { key: "numero_variacao_carteira", label: "Variação carteira", secret: false, required: true }
    ],
    supportsBoleto: true,
    supportsPix: false
  },
  c6: {
    id: "c6",
    label: "C6 Bank",
    enabled: envEnabled("GATEWAY_C6_ENABLED", true),
    authType: "oauth_basic",
    credentialFields: [
      { key: "client_id", label: "Client ID", secret: false, required: true },
      { key: "client_secret", label: "Client Secret", secret: true, required: true },
      { key: "codigo_cedente", label: "Código cedente", secret: false, required: true },
      { key: "agencia", label: "Agência", secret: false, required: true },
      { key: "conta", label: "Conta", secret: false, required: true },
      { key: "modalidade", label: "Modalidade", secret: false, required: true }
    ],
    supportsBoleto: true,
    supportsPix: false
  }
};

export function getProviderMeta(provider: string): GatewayProviderMeta {
  const meta = GATEWAY_REGISTRY[provider.trim().toLowerCase()];
  if (!meta) {
    throw new Error(`unknown_gateway_provider:${provider}`);
  }
  return meta;
}

export function listAvailableProviders(): GatewayProviderMeta[] {
  return Object.values(GATEWAY_REGISTRY).filter((p) => p.enabled);
}
