export type PemErrorCode =
  | "ERR-001"
  | "ERR-002"
  | "ERR-003"
  | "ERR-004"
  | "ERR-005"
  | "ERR-006"
  | "ERR-007"
  | "ERR-008"
  | "ERR-009"
  | "WARN-001"
  | "NET-001";

export type PemFieldKind = "certificate" | "private_key";

export type PemValidationFailure = {
  ok: false;
  error_code: PemErrorCode;
  message: string;
  field?: PemFieldKind;
};

export type PemValidationSuccess = {
  ok: true;
  warnings: PemErrorCode[];
};

export type PemValidationResult = PemValidationFailure | PemValidationSuccess;

const MESSAGES: Record<PemErrorCode, string> = {
  "ERR-001":
    "O arquivo não está no formato PEM. Verifique se contém os delimitadores -----BEGIN...----- / -----END...-----.",
  "ERR-002":
    "Tipo de arquivo incorreto para este campo. Campos de certificado e chave privada são separados.",
  "ERR-003":
    "O arquivo contém caracteres inválidos ou linhas muito longas. Pode estar corrompido.",
  "ERR-004": "Arquivo excede 64 KB. Verifique se o arquivo está correto.",
  "ERR-005": "Certificado expirado em {data}. Não é possível usar um certificado vencido.",
  "ERR-006": "Certificado ainda não vigente. Início da validade: {data}.",
  "ERR-007":
    "A chave privada não corresponde ao certificado enviado. Os arquivos devem fazer parte do mesmo par.",
  "ERR-008":
    "Algoritmo de assinatura não suportado ({alg}). Use SHA-256 ou superior com RSA ≥ 2048 bits.",
  "ERR-009": "Não foi possível ler o certificado. O arquivo pode estar corrompido.",
  "WARN-001": "O certificado expira em {n} dias ({data}). Recomendamos renová-lo em breve.",
  "NET-001": "Não foi possível validar o certificado. Verifique sua conexão e tente novamente."
};

export function formatPemMessage(code: PemErrorCode, vars: Record<string, string | number> = {}): string {
  let text = MESSAGES[code];
  for (const [key, value] of Object.entries(vars)) {
    text = text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
  }
  return text;
}

export function pemFailure(
  error_code: PemErrorCode,
  vars: Record<string, string | number> = {},
  field?: PemFieldKind
): PemValidationFailure {
  return { ok: false, error_code, message: formatPemMessage(error_code, vars), field };
}

export const PEM_MAX_BYTES = 64 * 1024;

export const ALLOWED_PEM_EXTENSIONS = new Set([".pem", ".crt", ".key", ".cer"]);

const PEM_BLOCK_RE = /-----BEGIN ([^-]+)-----[\s\S]*?-----END \1-----/g;

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

export function decodePemBody(pem: string): boolean {
  const lines = pem.split("\n");
  const bodyLines = lines.filter((line) => !line.startsWith("-----"));
  const body = bodyLines.join("").trim();
  if (!body) {
    return false;
  }
  if (!/^[A-Za-z0-9+/=\s]+$/.test(body)) {
    return false;
  }
  for (const line of bodyLines) {
    if (line.length > 64) {
      return false;
    }
  }
  try {
    atob(body.replace(/\s/g, ""));
    return true;
  } catch {
    return false;
  }
}

export function validateAllowedExtension(filename: string): boolean {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot < 0) {
    return false;
  }
  return ALLOWED_PEM_EXTENSIONS.has(lower.slice(dot));
}

/** RV-01 a RV-04 — validação local no browser (espelha backend). */
export function validatePemFileLocal(
  content: string,
  filename: string,
  field: PemFieldKind,
  byteLength: number
): PemValidationResult {
  if (!validateAllowedExtension(filename)) {
    return pemFailure("ERR-001", {}, field);
  }

  if (byteLength === 0 || byteLength > PEM_MAX_BYTES) {
    return pemFailure("ERR-004", {}, field);
  }

  const blocks = extractPemBlocks(content);
  if (blocks.length === 0) {
    return pemFailure("ERR-001", {}, field);
  }

  if (field === "certificate") {
    const certBlocks = blocks.filter((b) => isCertificateBlockType(b.type));
    if (certBlocks.length === 0) {
      return pemFailure("ERR-002", {}, field);
    }
    if (certBlocks.length > 1 || blocks.some((b) => isPrivateKeyBlockType(b.type))) {
      return pemFailure("ERR-002", {}, field);
    }
    if (!decodePemBody(certBlocks[0]!.pem)) {
      return pemFailure("ERR-003", {}, field);
    }
    return { ok: true, warnings: [] };
  }

  const keyBlocks = blocks.filter((b) => isPrivateKeyBlockType(b.type));
  if (keyBlocks.length === 0) {
    return pemFailure("ERR-002", {}, field);
  }
  if (keyBlocks.some((b) => b.type === "ENCRYPTED PRIVATE KEY")) {
    return pemFailure("ERR-002", {}, field);
  }
  if (blocks.some((b) => isCertificateBlockType(b.type))) {
    return pemFailure("ERR-002", {}, field);
  }
  if (!decodePemBody(keyBlocks[0]!.pem)) {
    return pemFailure("ERR-003", {}, field);
  }
  return { ok: true, warnings: [] };
}

export function pemPreviewLines(content: string): { header: string; footer: string } | null {
  const blocks = extractPemBlocks(content);
  const block = blocks[0];
  if (!block) {
    return null;
  }
  const lines = block.pem.split("\n");
  if (lines.length < 2) {
    return null;
  }
  return { header: lines[0]!, footer: lines[lines.length - 1]! };
}
