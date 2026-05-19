/**
 * Validacao de digitos verificadores de CPF e CNPJ (apenas numeros).
 */

export function isValidCpfDigits(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf)) {
    return false;
  }
  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  let sum = 0;
  for (let i = 0; i < 9; i += 1) {
    sum += parseInt(cpf[i], 10) * (10 - i);
  }
  let d1 = (sum * 10) % 11;
  if (d1 === 10) {
    d1 = 0;
  }
  if (d1 !== parseInt(cpf[9], 10)) {
    return false;
  }

  sum = 0;
  for (let i = 0; i < 10; i += 1) {
    sum += parseInt(cpf[i], 10) * (11 - i);
  }
  let d2 = (sum * 10) % 11;
  if (d2 === 10) {
    d2 = 0;
  }
  return d2 === parseInt(cpf[10], 10);
}

const CNPJ_W1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_W2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

function cnpjCheckDigit(base: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i += 1) {
    sum += parseInt(base[i], 10) * weights[i];
  }
  const mod = sum % 11;
  return mod < 2 ? 0 : 11 - mod;
}

export function isValidCnpjDigits(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj)) {
    return false;
  }
  if (/^(\d)\1{13}$/.test(cnpj)) {
    return false;
  }

  const d1 = cnpjCheckDigit(cnpj, CNPJ_W1);
  if (d1 !== parseInt(cnpj[12], 10)) {
    return false;
  }
  const d2 = cnpjCheckDigit(cnpj, CNPJ_W2);
  return d2 === parseInt(cnpj[13], 10);
}

export function isValidBrTaxIdDigits(digits: string): boolean {
  if (digits.length === 11) {
    return isValidCpfDigits(digits);
  }
  if (digits.length === 14) {
    return isValidCnpjDigits(digits);
  }
  return false;
}

/**
 * Monta um CNPJ com DV valido a partir de 12 digitos (raiz + filial), para testes e cargas controladas.
 * Rejeita base com todos os digitos iguais (invalido pelo algoritmo de validacao).
 */
export function buildCnpjFrom12BaseDigits(base12: string): string {
  if (!/^\d{12}$/.test(base12)) {
    throw new Error("base12 deve ter exatamente 12 digitos");
  }
  if (/^(\d)\1{11}$/.test(base12)) {
    throw new Error("CNPJ base invalido: repeticao de um unico digito");
  }
  const d1 = cnpjCheckDigit(base12 + "00", CNPJ_W1);
  const d1s = String(d1);
  const d2 = cnpjCheckDigit(base12 + d1s + "0", CNPJ_W2);
  return base12 + d1s + String(d2);
}

/** CNPJ valido e estavel por execucao (unico com alta probabilidade). */
export function uniqueTestCnpj(seedMs: number, salt = 0): string {
  const hi = Math.floor(seedMs / 1e6) % 1e6;
  const lo = (seedMs + salt * 9973) % 1e6;
  const base12 = `${String(hi).padStart(6, "0")}${String(lo).padStart(6, "0")}`.slice(0, 12);
  if (/^(\d)\1{11}$/.test(base12)) {
    return uniqueTestCnpj(seedMs + 1, salt + 1);
  }
  return buildCnpjFrom12BaseDigits(base12);
}
