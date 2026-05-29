import type { ClienteEnderecoBody } from "./api";

/** Endereço mínimo exigido por Inter / Cora / C6 na emissão. */
export function isCompleteClienteEmissionAddress(
  endereco: ClienteEnderecoBody | null | undefined
): boolean {
  if (!endereco) {
    return false;
  }
  const cep = endereco.cep.replace(/\D/g, "");
  return (
    cep.length === 8 &&
    Boolean(endereco.logradouro?.trim()) &&
    Boolean(endereco.bairro?.trim()) &&
    Boolean(endereco.cidade?.trim()) &&
    (endereco.uf?.trim().length ?? 0) === 2
  );
}
