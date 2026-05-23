/** URLs utilizáveis no portal (http/https). Ignora placeholders tipo inter:// */
export function isUsableHttpUrl(url: string | null | undefined): boolean {
  const raw = url?.trim();
  if (!raw) {
    return false;
  }
  try {
    const u = new URL(raw);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
