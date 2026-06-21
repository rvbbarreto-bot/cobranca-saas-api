/** Chaves de exemplo do .env.example ou valores obviamente inválidos para billing da plataforma. */
const PLACEHOLDER_PATTERNS = [
  /^TROCAR_/i,
  /sua_asaas_api_key/i,
  /^changeme$/i,
  /^your[_-]?api[_-]?key$/i
];

export function isUsableAsaasPlatformApiKey(apiKey: string | undefined | null): apiKey is string {
  const key = apiKey?.trim();
  if (!key || key.length < 16) {
    return false;
  }
  return !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(key));
}
