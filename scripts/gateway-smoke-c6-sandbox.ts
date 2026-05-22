/**
 * Smoke C6 sandbox — requer credenciais no escritorio_config.
 * Uso: RUN_C6_SANDBOX=1 npm run gateway:smoke:c6
 */
if (process.env.RUN_C6_SANDBOX !== "1") {
  console.info("Defina RUN_C6_SANDBOX=1 para executar smoke C6.");
  process.exit(0);
}

console.info(
  "Smoke C6: configure tenant com gateway_provider=c6 e credenciais; emissao via worker ou PATCH /gateway."
);
