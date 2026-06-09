import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { fetchFiscalIngestStatus, type FiscalIngestPublic } from "../lib/api";
import { FISCAL_INGEST_POLL_MS, shouldPollFiscalIngest } from "../lib/fiscal-ingest-ui";

export type FiscalIngestPolling = {
  query: UseQueryResult<{ ingest: FiscalIngestPublic }, Error>;
  ingest: FiscalIngestPublic | undefined;
  isPolling: boolean;
};

export function useFiscalIngestPolling(ingestId: string | null): FiscalIngestPolling {
  const query = useQuery({
    queryKey: ["fiscalIngest", ingestId],
    queryFn: () => fetchFiscalIngestStatus(ingestId!),
    enabled: Boolean(ingestId),
    refetchInterval: (q) =>
      shouldPollFiscalIngest(q.state.data?.ingest.status) ? FISCAL_INGEST_POLL_MS : false
  });

  return {
    query,
    ingest: query.data?.ingest,
    isPolling: shouldPollFiscalIngest(query.data?.ingest.status)
  };
}
