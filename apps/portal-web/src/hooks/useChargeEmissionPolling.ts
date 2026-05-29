import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchPortalCobrancaDetail, type PortalCobrancaDetailResponse } from "../lib/api";
import { CHARGE_DETAIL_POLL_MS, shouldPollChargeDetail } from "../lib/charge-detail-poll";

/**
 * Orçamento total de espera pela confirmação de emissão antes de parar o
 * polling e mostrar o aviso inconclusivo (RN-001). O intervalo entre
 * checagens continua sendo CHARGE_DETAIL_POLL_MS.
 */
export const CHARGE_EMISSION_TIMEOUT_MS = 30_000;

export type ChargeEmissionPolling = {
  query: UseQueryResult<PortalCobrancaDetailResponse, Error>;
  detail: PortalCobrancaDetailResponse | undefined;
  /** Polling ativo: servidor ainda não confirmou e o orçamento não estourou. */
  isPolling: boolean;
  /** Orçamento estourou sem status conclusivo — emissão inconclusiva. */
  timeoutReached: boolean;
  /** Reinicia um novo ciclo de polling (após acionar nova tentativa). */
  resetPolling: () => void;
};

/**
 * Envelopa o detalhe da cobrança com timeout de polling. Enquanto o servidor
 * indicar que vale pollar (rascunho sem payment) e o orçamento não estourar,
 * o react-query refaz o GET a cada CHARGE_DETAIL_POLL_MS. Ao atingir o
 * orçamento, o polling para e `timeoutReached` fica true.
 *
 * Resolução automática: se um webhook/reconciliação atualizar o status
 * enquanto esperamos, `shouldPollChargeDetail` passa a ser false e o aviso é
 * automaticamente escondido (timeoutReached volta a false).
 */
export function useChargeEmissionPolling(chargeId: string | undefined): ChargeEmissionPolling {
  const [timeoutReached, setTimeoutReached] = useState(false);
  // Marca o início do ciclo atual; usado para calcular o tempo restante do
  // timeout mesmo após remontagens/re-renderizações.
  const cycleStartRef = useRef<number>(Date.now());

  const query = useQuery<PortalCobrancaDetailResponse, Error>({
    queryKey: ["cobranca", chargeId],
    queryFn: () => fetchPortalCobrancaDetail(chargeId!),
    enabled: Boolean(chargeId),
    refetchInterval: (q) =>
      !timeoutReached && shouldPollChargeDetail(q.state.data) ? CHARGE_DETAIL_POLL_MS : false
  });

  const serverWantsPolling = shouldPollChargeDetail(query.data);
  const isPolling = serverWantsPolling && !timeoutReached;

  // Servidor resolveu (payment chegou ou status terminal): esconde o aviso de
  // timeout de um ciclo anterior.
  useEffect(() => {
    if (!serverWantsPolling && timeoutReached) {
      setTimeoutReached(false);
    }
  }, [serverWantsPolling, timeoutReached]);

  // Timer do ciclo atual: ao iniciar/retomar o polling agenda o estouro do
  // orçamento. O cleanup cancela o timer quando o polling para por qualquer
  // motivo (status resolvido, timeout, desmontagem).
  useEffect(() => {
    if (!isPolling) {
      return;
    }
    const remaining = CHARGE_EMISSION_TIMEOUT_MS - (Date.now() - cycleStartRef.current);
    const timer = setTimeout(() => setTimeoutReached(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [isPolling]);

  const resetPolling = useCallback(() => {
    cycleStartRef.current = Date.now();
    setTimeoutReached(false);
  }, []);

  return { query, detail: query.data, isPolling, timeoutReached, resetPolling };
}
