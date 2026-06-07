/**
 * Re-export retrocompativel — implementacao em http-receita-fiscal-gateway.ts (DAS + DARF).
 */
export {
  HttpReceitaFiscalGateway,
  HttpReceitaFiscalGateway as HttpReceitaDasGateway,
  createReceitaFiscalGateway,
  createReceitaFiscalGateway as createReceitaDasGateway,
  getReceitaCaptureUrl,
  getReceitaCaptureUrl as getReceitaDasCaptureUrl,
  isReceitaTlsInsecure,
  isReceitaTlsInsecure as isReceitaDasTlsInsecure,
  type HttpReceitaFiscalGatewayConfig,
  type HttpReceitaFiscalGatewayConfig as HttpReceitaDasGatewayConfig
} from "./http-receita-fiscal-gateway";
