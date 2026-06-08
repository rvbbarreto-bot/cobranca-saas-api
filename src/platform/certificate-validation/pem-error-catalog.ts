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
  | "INFO-001"
  | "INFO-002"
  | "NET-001";

export type PemValidationFailure = {
  ok: false;
  error_code: PemErrorCode;
  message: string;
  field?: "certificate" | "private_key";
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
  "INFO-001": "Certificado válido. Expira em {data} · CN: {cn} · Emitido por: {issuer}.",
  "INFO-002": "Par certificado/chave validado com sucesso.",
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
  field?: "certificate" | "private_key"
): PemValidationFailure {
  return { ok: false, error_code, message: formatPemMessage(error_code, vars), field };
}
