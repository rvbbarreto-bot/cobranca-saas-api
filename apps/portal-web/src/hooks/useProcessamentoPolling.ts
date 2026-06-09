import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import {
  fetchProcessamentoFiscalDetail,
  type ProcessamentoEventoRow,
  type ProcessamentoFiscalRow
} from "../lib/api";
import { PROCESSAMENTO_POLL_MS, shouldPollProcessamentoDetail } from "../lib/processamento-fiscal-ui";

export type ProcessamentoDetailPolling = {
  query: UseQueryResult<
    { processamento: ProcessamentoFiscalRow; eventos: ProcessamentoEventoRow[] },
    Error
  >;
  processamento: ProcessamentoFiscalRow | undefined;
  eventos: ProcessamentoEventoRow[];
  isPolling: boolean;
};

export function useProcessamentoPolling(processamentoId: string | undefined): ProcessamentoDetailPolling {
  const query = useQuery({
    queryKey: ["processamentoFiscal", processamentoId],
    queryFn: () => fetchProcessamentoFiscalDetail(processamentoId!),
    enabled: Boolean(processamentoId),
    refetchInterval: (q) =>
      shouldPollProcessamentoDetail(q.state.data?.processamento.status)
        ? PROCESSAMENTO_POLL_MS
        : false
  });

  return {
    query,
    processamento: query.data?.processamento,
    eventos: query.data?.eventos ?? [],
    isPolling: shouldPollProcessamentoDetail(query.data?.processamento.status)
  };
}
