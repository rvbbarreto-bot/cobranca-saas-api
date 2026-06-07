/**
 * Re-export do gateway fiscal unificado (DAS + DARF).
 * Fase 2.1 — captura DARF via POST /darf/capture na mesma base URL.
 */
export {
  HttpReceitaFiscalGateway as HttpReceitaDarfGateway,
  createReceitaFiscalGateway as createReceitaDarfGateway,
  getReceitaCaptureUrl as getReceitaDarfCaptureUrl
} from "./http-receita-fiscal-gateway";
