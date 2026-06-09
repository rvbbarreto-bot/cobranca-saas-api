export type ReceitaGatewayProvider = "exeq" | "mock" | "serpro";

export function getReceitaGatewayProvider(): ReceitaGatewayProvider {
  const raw = process.env.RECEITA_GATEWAY_PROVIDER?.trim().toLowerCase();
  if (raw === "mock" || raw === "serpro" || raw === "exeq") {
    return raw;
  }
  return "exeq";
}
