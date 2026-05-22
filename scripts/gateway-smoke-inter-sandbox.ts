/**
 * Smoke Inter sandbox — requer credenciais no escritorio_config do tenant demo.
 * Uso: RUN_INTER_SANDBOX=1 npm run gateway:smoke:inter
 */
if (process.env.RUN_INTER_SANDBOX !== "1") {
  console.info("Defina RUN_INTER_SANDBOX=1 para executar smoke Inter.");
  process.exit(0);
}

console.info("Smoke Inter: configure tenant com gateway_provider=inter e credenciais sandbox; use worker de emissao ou API portal.");
