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

function buildCnpjFrom12BaseDigits(base12: string): string {
  const d1 = cnpjCheckDigit(base12 + "00", CNPJ_W1);
  const d1s = String(d1);
  const d2 = cnpjCheckDigit(base12 + d1s + "0", CNPJ_W2);
  return base12 + d1s + String(d2);
}

/** CNPJ válido e único por execução (alinhado a `br-cpf-cnpj.uniqueTestCnpj`). */
export function uniqueTestCnpj(seedMs = Date.now(), salt = 0): string {
  const hi = Math.floor(seedMs / 1e6) % 1e6;
  const lo = (seedMs + salt * 9973) % 1e6;
  const base12 = `${String(hi).padStart(6, "0")}${String(lo).padStart(6, "0")}`.slice(0, 12);
  if (/^(\d)\1{11}$/.test(base12)) {
    return uniqueTestCnpj(seedMs + 1, salt + 1);
  }
  return buildCnpjFrom12BaseDigits(base12);
}
