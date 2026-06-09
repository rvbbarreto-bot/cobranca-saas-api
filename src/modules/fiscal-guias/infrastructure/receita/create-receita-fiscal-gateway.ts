import { getReceitaGatewayProvider } from "../../../../platform/config/receita-gateway-provider";
import { isSerproMockEnabled } from "../../../../platform/config/fiscal-serpro-enabled";
import { MockSerproIntegraContadorClient } from "../../../serpro-integra-contador/infrastructure/serpro-integra-client";
import type { ReceitaFiscalGateway } from "../../domain/receita-gateway.interface";
import {
  HttpReceitaFiscalGateway,
  getReceitaCaptureUrl
} from "./http-receita-fiscal-gateway";
import { MockReceitaFiscalGateway } from "./mock-receita-fiscal-gateway";
import { SerproReceitaFiscalGateway } from "./serpro-receita-fiscal-gateway";

export type CreateReceitaFiscalGatewayOptions = {
  /** Override provider (tests). */
  provider?: ReturnType<typeof getReceitaGatewayProvider>;
  /** Contratante CNPJ para provider serpro (default env ou demo). */
  contratanteCnpj?: string;
};

function defaultSerproContratanteCnpj(): string {
  return (
    process.env.RECEITA_SERPRO_CONTRATANTE_CNPJ?.trim().replace(/\D/g, "") || "00000000000191"
  );
}

function createExeqGateway(): ReceitaFiscalGateway | null {
  const url = getReceitaCaptureUrl();
  if (!url) return null;
  return new HttpReceitaFiscalGateway({ baseUrl: url });
}

function createSerproGateway(contratanteCnpj: string): ReceitaFiscalGateway {
  if (!isSerproMockEnabled() && process.env.NODE_ENV === "production") {
    throw new Error(
      "RECEITA_GATEWAY_PROVIDER=serpro em producao exige FISCAL_SERPRO_MOCK=false e client live (FISC-001)."
    );
  }
  const client = new MockSerproIntegraContadorClient();
  return new SerproReceitaFiscalGateway({
    client,
    accessToken: "mock-token",
    contratanteCnpj
  });
}

export function createReceitaFiscalGateway(
  options: CreateReceitaFiscalGatewayOptions = {}
): ReceitaFiscalGateway | null {
  const provider = options.provider ?? getReceitaGatewayProvider();

  if (provider === "mock") {
    return new MockReceitaFiscalGateway();
  }

  if (provider === "serpro") {
    return createSerproGateway(options.contratanteCnpj ?? defaultSerproContratanteCnpj());
  }

  return createExeqGateway();
}

/** @deprecated use createReceitaFiscalGateway */
export function createReceitaDasGateway(
  options: CreateReceitaFiscalGatewayOptions = {}
): ReceitaFiscalGateway | null {
  return createReceitaFiscalGateway(options);
}

/** @deprecated import from create-receita-fiscal-gateway */
export { getReceitaCaptureUrl };
