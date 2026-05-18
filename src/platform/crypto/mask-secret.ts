/** Mascara segredo para resposta HTTP (ultimos 4 caracteres). */
export function maskSecret(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }
  const v = value.trim();
  if (v.length <= 4) {
    return "****";
  }
  return `****${v.slice(-4)}`;
}
