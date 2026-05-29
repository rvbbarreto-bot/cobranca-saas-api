import type { ChargeEventRow } from "./charge-detail-timeline";
import { extractEmissionError } from "./charge-detail-timeline";

export type ChargeDetailBannerState = {
  /** Falha definitiva ou última falha ainda vigente (status erro_emissao). */
  emissionError: string | null;
  /** Polling ativo — emissão em andamento. */
  showEmissionProgress: boolean;
  /** Timeout do polling sem confirmação — emissão inconclusiva. */
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
  timeoutReached: boolean;
  hasPayment: boolean;
}): ChargeDetailBannerState {
  const { events, chargeStatus, isPolling, timeoutReached, hasPayment } = input;

  const emissionError = extractEmissionError(events, { chargeStatus });

  const showEmissionProgress = Boolean(chargeStatus) && isPolling && !emissionError;

  const showEmissionInconclusive =
    chargeStatus === "rascunho" &&
    !hasPayment &&
    timeoutReached &&
    !isPolling &&
    !emissionError;

  return { emissionError, showEmissionProgress, showEmissionInconclusive };
}
