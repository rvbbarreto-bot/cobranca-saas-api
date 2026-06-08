const PEM_BLOCK_RE = /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g;

/** Alinha com API: extrai blocos PEM e descarta lixo de terminal/paths colados por engano. */
export function sanitizePemPaste(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.match(PEM_BLOCK_RE);
  if (blocks?.length) {
    return blocks.map((block) => block.trim()).join("\n");
  }
  return normalized.trim();
}

export function sanitizeGatewayCredentials(
  credentials: Record<string, string>
): Record<string, string> {
  const out = { ...credentials };
  if (out.certificate_pem?.trim()) {
    out.certificate_pem = sanitizePemPaste(out.certificate_pem);
  }
  if (out.private_key_pem?.trim()) {
    out.private_key_pem = sanitizePemPaste(out.private_key_pem);
  }
  return out;
}
