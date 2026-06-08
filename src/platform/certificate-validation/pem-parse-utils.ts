const PEM_BLOCK_RE = /-----BEGIN ([^-]+)-----[\s\S]*?-----END \1-----/g;

export const PEM_MAX_BYTES = 64 * 1024;

export const ALLOWED_PEM_EXTENSIONS = new Set([".pem", ".crt", ".key", ".cer"]);

export type PemBlock = {
  type: string;
  pem: string;
};

export function extractPemBlocks(raw: string): PemBlock[] {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks: PemBlock[] = [];
  const re = new RegExp(PEM_BLOCK_RE.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized)) !== null) {
    blocks.push({ type: match[1]!.trim(), pem: match[0]!.trim() });
  }
  return blocks;
}

export function isCertificateBlockType(type: string): boolean {
  return type === "CERTIFICATE";
}

export function isPrivateKeyBlockType(type: string): boolean {
  return (
    type === "PRIVATE KEY" ||
    type === "RSA PRIVATE KEY" ||
    type === "EC PRIVATE KEY" ||
    type === "ENCRYPTED PRIVATE KEY"
  );
}

export function decodePemBody(pem: string): Buffer | null {
  const lines = pem.split("\n");
  const bodyLines = lines.filter((line) => !line.startsWith("-----"));
  const body = bodyLines.join("").trim();
  if (!body) {
    return null;
  }
  if (!/^[A-Za-z0-9+/=\s]+$/.test(body)) {
    return null;
  }
  for (const line of bodyLines) {
    if (line.length > 64) {
      return null;
    }
  }
  try {
    return Buffer.from(body.replace(/\s/g, ""), "base64");
  } catch {
    return null;
  }
}

export function readUploadAsUtf8(buffer: Buffer): string {
  return buffer.toString("utf8");
}
