import { X509Certificate } from "node:crypto";

function extractSubjectField(subject: string, key: string): string | undefined {
  const re = new RegExp(`(?:^|/|\\n)${key}=([^/\\n]+)`);
  const match = subject.match(re);
  return match?.[1]?.trim();
}

/** Extrai CPF/CNPJ e nome do titular a partir do subject ICP-Brasil (e-CPF / e-CNPJ). */
export function parseIcpBrasilCertIdentity(certificadoPem: string): {
  documento: string;
  documentoTipo: "PF" | "PJ";
  nome: string;
} {
  const x = new X509Certificate(certificadoPem);
  const cn = extractSubjectField(x.subject, "CN") ?? "";

  const colonMatch = cn.match(/^(.+):(\d{11}|\d{14})$/);
  if (colonMatch) {
    const documento = colonMatch[2];
    return {
      documento,
      documentoTipo: documento.length === 11 ? "PF" : "PJ",
      nome: colonMatch[1].trim()
    };
  }

  const digits = cn.replace(/\D/g, "");
  if (digits.length === 11 || digits.length === 14) {
    return {
      documento: digits,
      documentoTipo: digits.length === 11 ? "PF" : "PJ",
      nome: cn.trim() || digits
    };
  }

  throw new Error(
    "SERPRO_CERT_SUBJECT_UNPARSEABLE — CN do certificado deve conter CPF/CNPJ (formato NOME:DOC)."
  );
}
