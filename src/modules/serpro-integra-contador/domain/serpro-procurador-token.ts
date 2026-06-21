/** Extrai autenticar_procurador_token (header jwt_token) da resposta SERPRO. */
export function parseSerproProcuradorToken(raw: unknown): {
  token: string;
  expiresAt: string | null;
} | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const root = raw as Record<string, unknown>;
  let dados: unknown = root.dados;
  if (typeof dados === "string" && dados.trim()) {
    try {
      dados = JSON.parse(dados) as unknown;
    } catch {
      return null;
    }
  }
  if (!dados || typeof dados !== "object") {
    return null;
  }
  const o = dados as Record<string, unknown>;
  const token =
    typeof o.autenticar_procurador_token === "string" ? o.autenticar_procurador_token.trim() : "";
  if (!token) {
    return null;
  }
  const expiresAt =
    typeof o.data_hora_expiracao === "string" ? o.data_hora_expiracao.trim() : null;
  return { token, expiresAt };
}

/** etag: "autenticar_procurador_token:uuid" */
export function parseSerproProcuradorTokenFromEtag(etag: string | undefined): string | null {
  if (!etag?.trim()) {
    return null;
  }
  const cleaned = etag.replace(/^W\//, "").replace(/^"|"$/g, "");
  const prefix = "autenticar_procurador_token:";
  const idx = cleaned.indexOf(prefix);
  if (idx < 0) {
    return null;
  }
  const token = cleaned.slice(idx + prefix.length).trim();
  return token || null;
}
