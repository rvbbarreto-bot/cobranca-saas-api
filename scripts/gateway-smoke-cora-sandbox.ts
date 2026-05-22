/**
 * Smoke Cora sandbox — requer credenciais no escritorio_config do tenant demo.
 * Uso: RUN_CORA_SANDBOX=1 npm run gateway:smoke:cora
 */
if (process.env.RUN_CORA_SANDBOX !== "1") {
  console.info("Defina RUN_CORA_SANDBOX=1 para executar smoke Cora.");
  process.exit(0);
}

console.info("Smoke Cora: configure tenant com gateway_provider=cora e credenciais sandbox; use worker de emissao ou API portal.");
