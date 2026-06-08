import type { ChargeEventRow } from "./charge-detail-timeline";
import { extractEmissionError } from "./charge-detail-timeline";

export type ChargeDetailBannerState = {
  /** Falha definitiva ou última falha ainda vigente (status erro_emissao). */
  emissionError: string | null;
  /** Polling ativo — emissão em andamento. */
  showEmissionProgress: boolean;
  /** Emissão demorando (worker ainda pode concluir; polling segue). */
  showEmissionSlowWarning: boolean;
  /** @deprecated use showEmissionSlowWarning */
  showEmissionInconclusive: boolean;
};

/**
 * Define quais banners exibir no detalhe do boleto, evitando mensagens
 * contraditórias (erro antigo + em andamento + timeout ao mesmo tempo).
 */
export function resolveChargeDetailBanners(input: {
  events: ChargeEventRow[];
  chargeStatus: string | undefined;
  isPolling: boolean;
  slowEmissionWarning: boolean;
  /** @deprecated use slowEmissionWarning */
  timeoutReached?: boolean;
  hasPayment: boolean;
}): ChargeDetailBannerState {
  const slowWarning = input.slowEmissionWarning ?? input.timeoutReached ?? false;
  const { events, chargeStatus, isPolling, hasPayment } = input;

  const emissionError = extractEmissionError(events, { chargeStatus });

  const showEmissionProgress =
    Boolean(chargeStatus) && isPolling && !emissionError && !slowWarning;

  const showEmissionSlowWarning =
    chargeStatus === "rascunho" && !hasPayment && slowWarning && !emissionError;

  return {
    emissionError,
    showEmissionProgress,
    showEmissionSlowWarning,
    showEmissionInconclusive: showEmissionSlowWarning
  };
}
