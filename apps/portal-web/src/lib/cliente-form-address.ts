import { onlyDigits } from "./br-tax-id";
import type { ClienteEnderecoPayload } from "./schemas";

export type ClienteAddressFormInput = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/**
 * Monta payload de endereco para POST /v1/portal/clientes.
 * Se o usuario preencheu parte do endereco, exige CEP + logradouro + bairro + cidade + UF.
 */
export function buildClienteEnderecoPayload(
  input: ClienteAddressFormInput
): { endereco?: ClienteEnderecoPayload; fieldErrors?: Record<string, string> } {
  const cepDigits = onlyDigits(input.cep);
  const hasAddr =
    cepDigits.length > 0 ||
    input.logradouro.trim().length > 0 ||
    input.bairro.trim().length > 0 ||
    input.cidade.trim().length > 0 ||
    input.uf.trim().length > 0;

  if (!hasAddr) {
    return {};
  }

  if (
    cepDigits.length !== 8 ||
    !input.logradouro.trim() ||
    !input.bairro.trim() ||
    !input.cidade.trim() ||
    input.uf.trim().length !== 2
  ) {
    const fieldErrors: Record<string, string> = {};
    if (cepDigits.length !== 8) {
      fieldErrors.cep = "CEP com 8 digitos.";
    }
    fieldErrors.endereco =
      "Preencha CEP, logradouro, bairro, cidade e UF para salvar o endereco (obrigatorio para emissao em alguns bancos).";
    return { fieldErrors };
  }

  return {
    endereco: {
      cep: cepDigits,
      logradouro: input.logradouro.trim(),
      numero: input.numero.trim() || null,
      complemento: input.complemento.trim() || null,
      bairro: input.bairro.trim(),
      cidade: input.cidade.trim(),
      uf: input.uf.trim().toUpperCase()
    }
  };
}
