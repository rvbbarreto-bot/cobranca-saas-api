import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchPortalCobrancaDetail, type PortalCobrancaDetailResponse } from "../lib/api";
import { CHARGE_DETAIL_POLL_MS, shouldPollChargeDetail } from "../lib/charge-detail-poll";

/**
 * Tempo até exibir o aviso de emissão lenta (a página continua atualizando).
 * O worker pode levar até ~8 min com retentativas — o polling não para aqui.
 */
export const CHARGE_EMISSION_SLOW_WARNING_MS = 45_000;

/** @deprecated use CHARGE_EMISSION_SLOW_WARNING_MS */
export const CHARGE_EMISSION_TIMEOUT_MS = CHARGE_EMISSION_SLOW_WARNING_MS;

export type ChargeEmissionPolling = {
  query: UseQueryResult<PortalCobrancaDetailResponse, Error>;
  detail: PortalCobrancaDetailResponse | undefined;
  /** Polling ativo: servidor ainda não confirmou e o orçamento não estourou. */
  isPolling: boolean;
  /** Aviso de emissão lenta (polling segue ativo enquanto o servidor indicar). */
  slowEmissionWarning: boolean;
  /** @deprecated use slowEmissionWarning */
  timeoutReached: boolean;
  /** Reinicia um novo ciclo de polling (após acionar nova tentativa). */
  resetPolling: () => void;
};

/**
 * Envelopa o detalhe da cobrança com timeout de polling. Enquanto o servidor
 * indicar que vale pollar (rascunho sem payment), o react-query refaz o GET a
 * cada CHARGE_DETAIL_POLL_MS. Após CHARGE_EMISSION_SLOW_WARNING_MS, exibe o
 * aviso de demora sem interromper as atualizações.
 *
 * Resolução automática: se um webhook/reconciliação atualizar o status
 * enquanto esperamos, `shouldPollChargeDetail` passa a ser false e o aviso é
 * automaticamente escondido (timeoutReached volta a false).
 */
export function useChargeEmissionPolling(chargeId: string | undefined): ChargeEmissionPolling {
  const [slowEmissionWarning, setSlowEmissionWarning] = useState(false);
  const [pollCycleId, setPollCycleId] = useState(0);
  const cycleStartRef = useRef<number>(Date.now());

  const query = useQuery<PortalCobrancaDetailResponse, Error>({
    queryKey: ["cobranca", chargeId],
    queryFn: () => fetchPortalCobrancaDetail(chargeId!),
    enabled: Boolean(chargeId),
    refetchInterval: (q) =>
      shouldPollChargeDetail(q.state.data) ? CHARGE_DETAIL_POLL_MS : false
  });

  const serverWantsPolling = shouldPollChargeDetail(query.data);
  const isPolling = serverWantsPolling;

  // Servidor resolveu (payment chegou ou status terminal): esconde o aviso de
  // timeout de um ciclo anterior.
  useEffect(() => {
    if (!serverWantsPolling && slowEmissionWarning) {
      setSlowEmissionWarning(false);
    }
  }, [serverWantsPolling, slowEmissionWarning]);

  // Timer do ciclo atual: ao iniciar/retomar o polling agenda o estouro do
  // orçamento. O cleanup cancela o timer quando o polling para por qualquer
  // motivo (status resolvido, timeout, desmontagem).
  useEffect(() => {
    if (!isPolling) {
      return;
    }
    const remaining =
      CHARGE_EMISSION_SLOW_WARNING_MS - (Date.now() - cycleStartRef.current);
    const timer = setTimeout(() => setSlowEmissionWarning(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [isPolling, pollCycleId]);

  const resetPolling = useCallback(() => {
    cycleStartRef.current = Date.now();
    setSlowEmissionWarning(false);
    setPollCycleId((n) => n + 1);
  }, []);

  return {
    query,
    detail: query.data,
    isPolling,
    slowEmissionWarning,
    timeoutReached: slowEmissionWarning,
    resetPolling
  };
}
