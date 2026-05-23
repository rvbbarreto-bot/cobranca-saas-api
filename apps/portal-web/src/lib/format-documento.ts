import { maskCnpj, maskCpf, onlyDigits } from "./br-tax-id";

export function formatDocumentoDisplay(documento: string): string {
  const d = onlyDigits(documento);
  if (d.length === 11) {
    return maskCpf(d);
  }
  if (d.length === 14) {
    return maskCnpj(d);
  }
  return documento.trim();
}
