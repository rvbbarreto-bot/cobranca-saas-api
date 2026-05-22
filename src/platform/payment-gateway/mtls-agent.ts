import https from "node:https";

export type MtlsAgentInput = {
  certPem: string;
  keyPem: string;
};

/** Monta Agent HTTPS com certificado mTLS (PEM apenas em memoria). */
export function buildMtlsAgent(input: MtlsAgentInput): https.Agent {
  const certPem = input.certPem?.trim();
  const keyPem = input.keyPem?.trim();
  if (!certPem || !keyPem) {
    throw new Error("certificate_pem e private_key_pem sao obrigatorios para mTLS.");
  }
  return new https.Agent({
    cert: certPem,
    key: keyPem,
    rejectUnauthorized: true
  });
}
