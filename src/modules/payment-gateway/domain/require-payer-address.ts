import type { CustomerAddressInput } from "./payment-gateway.interface";
import { GatewayProviderError } from "./payment-gateway-error";

function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** Endereco completo exigido por gateways mTLS (Inter, Cora, C6). */
export function isCompletePayerAddress(
  endereco: CustomerAddressInput | undefined | null
): endereco is CustomerAddressInput {
  if (!endereco) {
    return false;
  }
  const cep = digitsOnly(endereco.cep);
  const logradouro = endereco.logradouro?.trim() ?? "";
  const bairro = endereco.bairro?.trim() ?? "";
  const cidade = endereco.cidade?.trim() ?? "";
  const uf = endereco.uf?.trim().toUpperCase() ?? "";
  return cep.length === 8 && Boolean(logradouro) && Boolean(bairro) && Boolean(cidade) && uf.length === 2;
}

export function requirePayerAddress(
  provider: string,
  endereco: CustomerAddressInput | undefined | null
): CustomerAddressInput {
  if (!isCompletePayerAddress(endereco)) {
    throw new GatewayProviderError(
      provider,
      "Endereco completo do pagador obrigatorio (CEP, logradouro, bairro, cidade e UF).",
      { code: "payer_address_required" }
    );
  }
  return endereco;
}
