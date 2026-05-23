import type { CustomerAddressInput } from "../../payment-gateway/domain/payment-gateway.interface";
import { onlyDigits } from "./portal-cliente-input";

export type PortalClienteAddressFields = {
  endereco_cep: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
};

export type PortalClienteEnderecoInput = {
  cep: string;
  logradouro: string;
  numero?: string | null;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
};

const UF_RE = /^[A-Za-z]{2}$/;

export function mapRowToCustomerAddress(row: PortalClienteAddressFields): CustomerAddressInput | undefined {
  const cep = row.endereco_cep ? onlyDigits(row.endereco_cep) : "";
  const logradouro = row.endereco_logradouro?.trim() ?? "";
  const bairro = row.endereco_bairro?.trim() ?? "";
  const cidade = row.endereco_cidade?.trim() ?? "";
  const uf = row.endereco_uf?.trim().toUpperCase() ?? "";
  if (cep.length !== 8 || !logradouro || !bairro || !cidade || uf.length !== 2) {
    return undefined;
  }
  return {
    cep,
    logradouro: logradouro.slice(0, 150),
    numero: row.endereco_numero?.trim() || undefined,
    complemento: row.endereco_complemento?.trim() || undefined,
    bairro: bairro.slice(0, 80),
    cidade: cidade.slice(0, 80),
    uf
  };
}

export function parsePortalClienteEnderecoBody(
  raw: unknown
): { ok: true; value: PortalClienteEnderecoInput } | { ok: false; message: string } {
  if (raw === undefined || raw === null) {
    return { ok: false, message: "Informe o objeto endereco." };
  }
  if (typeof raw !== "object") {
    return { ok: false, message: "endereco deve ser um objeto." };
  }
  const b = raw as Record<string, unknown>;
  const cep = onlyDigits(typeof b.cep === "string" ? b.cep : "");
  const logradouro = typeof b.logradouro === "string" ? b.logradouro.trim() : "";
  const bairro = typeof b.bairro === "string" ? b.bairro.trim() : "";
  const cidade = typeof b.cidade === "string" ? b.cidade.trim() : "";
  const uf = typeof b.uf === "string" ? b.uf.trim().toUpperCase() : "";
  if (cep.length !== 8) {
    return { ok: false, message: "CEP deve ter 8 digitos." };
  }
  if (!logradouro || logradouro.length > 150) {
    return { ok: false, message: "Logradouro obrigatorio (max. 150 caracteres)." };
  }
  if (!bairro || bairro.length > 80) {
    return { ok: false, message: "Bairro obrigatorio (max. 80 caracteres)." };
  }
  if (!cidade || cidade.length > 80) {
    return { ok: false, message: "Cidade obrigatoria (max. 80 caracteres)." };
  }
  if (!UF_RE.test(uf)) {
    return { ok: false, message: "UF invalida (2 letras)." };
  }
  const numero =
    b.numero === undefined || b.numero === null
      ? null
      : typeof b.numero === "string"
        ? b.numero.trim().slice(0, 20)
        : null;
  const complemento =
    b.complemento === undefined || b.complemento === null
      ? null
      : typeof b.complemento === "string"
        ? b.complemento.trim().slice(0, 80)
        : null;
  return {
    ok: true,
    value: { cep, logradouro, numero, complemento, bairro, cidade, uf }
  };
}

export function enderecoInputToColumns(
  endereco: PortalClienteEnderecoInput | null | undefined
): PortalClienteAddressFields {
  if (!endereco) {
    return {
      endereco_cep: null,
      endereco_logradouro: null,
      endereco_numero: null,
      endereco_complemento: null,
      endereco_bairro: null,
      endereco_cidade: null,
      endereco_uf: null
    };
  }
  return {
    endereco_cep: onlyDigits(endereco.cep),
    endereco_logradouro: endereco.logradouro,
    endereco_numero: endereco.numero ?? null,
    endereco_complemento: endereco.complemento ?? null,
    endereco_bairro: endereco.bairro,
    endereco_cidade: endereco.cidade,
    endereco_uf: endereco.uf.toUpperCase()
  };
}
