import "dotenv/config";

/**
 * Garante rotas mock de auth habilitadas nos testes, mesmo se o `.env` local tiver
 * `ENABLE_MOCK_AUTH=false` (comum ao validar producao na mesma maquina).
 */
process.env.ENABLE_MOCK_AUTH = "true";
