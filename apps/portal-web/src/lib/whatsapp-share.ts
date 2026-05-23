/** Dígitos E.164 sem + (ex.: 5511999998888). */
export function normalizeBrWhatsAppPhone(telefone: string | null | undefined): string | null {
  const digits = telefone?.replace(/\D/g, "") ?? "";
  if (digits.length < 10) {
    return null;
  }
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits;
  }
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits.length >= 12 ? digits : null;
}

export function buildWhatsAppShareUrl(phoneE164Digits: string, message: string): string {
  const text = encodeURIComponent(message);
  return `https://wa.me/${phoneE164Digits}?text=${text}`;
}

export function buildChargeWhatsAppMessage(input: {
  clienteNome: string;
  amountLabel: string;
  dueLabel: string;
  boletoUrl?: string | null;
  pdfUrl?: string | null;
  pixEmv?: string | null;
}): string {
  const lines = [
    `Olá, ${input.clienteNome}.`,
    `Segue a cobrança no valor de ${input.amountLabel}, com vencimento em ${input.dueLabel}.`
  ];
  if (input.boletoUrl?.trim()) {
    lines.push(`Boleto: ${input.boletoUrl.trim()}`);
  }
  if (input.pdfUrl?.trim()) {
    lines.push(`PDF: ${input.pdfUrl.trim()}`);
  }
  if (input.pixEmv?.trim()) {
    lines.push(`PIX copia e cola: ${input.pixEmv.trim()}`);
  }
  return lines.join("\n");
}
