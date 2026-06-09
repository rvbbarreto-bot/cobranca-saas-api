import { isValidBrTaxIdDigits, maskCnpj, onlyDigits } from "./br-tax-id";
import type { PatchSerproConfigBody, SerproConfigRow } from "./api";
import { MASKED_SECRET_DISPLAY } from "./gateway-config-form";

export type SerproAmbiente = "demo" | "prod";

export const SERPRO_AMBIENTE_OPTIONS: { value: SerproAmbiente; label: string; hint: string }[] = [
  { value: "demo", label: "Homologação (demo)", hint: "Ambiente de testes SERPRO — transmissões simuladas." },
  { value: "prod", label: "Produção", hint: "Ambiente oficial — declarações reais na Receita Federal." }
];

export function serproAmbienteLabel(ambiente: SerproAmbiente): string {
  return SERPRO_AMBIENTE_OPTIONS.find((o) => o.value === ambiente)?.label ?? ambiente;
}

export function isSerproIntegrationConfigured(config: SerproConfigRow | null | undefined): boolean {
  return Boolean(
    config?.serpro_enabled &&
      config.consumer_key_configured &&
      config.consumer_secret_configured &&
      config.contratante_cnpj?.trim()
  );
}

export function shouldStartSerproViewMode(config: SerproConfigRow | null | undefined): boolean {
  return isSerproIntegrationConfigured(config);
}

export function serproContratanteDisplay(config: SerproConfigRow | null | undefined): string {
  if (!config?.contratante_cnpj?.trim()) {
    return "—";
  }
  return config.contratante_cnpj;
}

export function serproCredentialDisplay(configured: boolean): string {
  return configured ? MASKED_SECRET_DISPLAY : "Não configurado";
}

export type SerproConfigFormState = {
  ambiente: SerproAmbiente;
  contratanteCnpj: string;
  consumerKey: string;
  consumerSecret: string;
  serproEnabled: boolean;
};

export function serproConfigToFormState(config: SerproConfigRow | null | undefined): SerproConfigFormState {
  return {
    ambiente: config?.ambiente ?? "demo",
    contratanteCnpj: "",
    consumerKey: "",
    consumerSecret: "",
    serproEnabled: config?.serpro_enabled ?? false
  };
}

export function validateSerproConfigForm(
  form: SerproConfigFormState,
  existing: SerproConfigRow | null | undefined
): string | null {
  const cnpjDigits = onlyDigits(form.contratanteCnpj);
  if (cnpjDigits.length !== 14 || !isValidBrTaxIdDigits(cnpjDigits)) {
    return "Informe o CNPJ do contratante SERPRO (14 dígitos válidos).";
  }
  if (form.serproEnabled) {
    const keyOk = form.consumerKey.trim().length >= 8 || existing?.consumer_key_configured;
    const secretOk = form.consumerSecret.trim().length >= 8 || existing?.consumer_secret_configured;
    if (!keyOk || !secretOk) {
      return "Para ativar a conexão, informe consumer key e consumer secret (mín. 8 caracteres cada).";
    }
  }
  return null;
}

export function buildPatchSerproConfigBody(
  form: SerproConfigFormState,
  existing: SerproConfigRow | null | undefined
): PatchSerproConfigBody {
  const body: PatchSerproConfigBody = {
    ambiente: form.ambiente,
    contratante_cnpj: onlyDigits(form.contratanteCnpj),
    serpro_enabled: form.serproEnabled
  };
  if (form.consumerKey.trim().length >= 8) {
    body.consumer_key = form.consumerKey.trim();
  } else if (!existing?.consumer_key_configured && form.serproEnabled) {
    body.consumer_key = form.consumerKey.trim();
  }
  if (form.consumerSecret.trim().length >= 8) {
    body.consumer_secret = form.consumerSecret.trim();
  } else if (!existing?.consumer_secret_configured && form.serproEnabled) {
    body.consumer_secret = form.consumerSecret.trim();
  }
  return body;
}

export function formatContratanteCnpjInput(value: string): string {
  return maskCnpj(value);
}
