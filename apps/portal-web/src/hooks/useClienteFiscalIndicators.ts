import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchCertificadoDigital,
  fetchExpiringCertificates,
  fetchProcessamentosFiscais,
  fetchProcuracao
} from "../lib/api";
import {
  buildClienteFiscalIndicators,
  expiringCertificatesByCliente,
  indexLatestProcessamentosByCliente,
  type ClienteFiscalIndicators
} from "../lib/cliente-fiscal-indicators";
import { isFiscalGuiasNavEnabled } from "../lib/fiscal-feature";

export function useClienteFiscalIndicators(clienteIds: string[]): {
  enabled: boolean;
  isLoading: boolean;
  byClienteId: Map<string, ClienteFiscalIndicators>;
} {
  const enabled = isFiscalGuiasNavEnabled() && clienteIds.length > 0;

  const processamentosQ = useQuery({
    queryKey: ["processamentosFiscais", "clienteIndicators"],
    queryFn: fetchProcessamentosFiscais,
    enabled,
    staleTime: 60_000
  });

  const expiringQ = useQuery({
    queryKey: ["fiscalExpiringCerts", "clienteIndicators"],
    queryFn: fetchExpiringCertificates,
    enabled,
    staleTime: 60_000
  });

  const latestByCliente = useMemo(
    () => indexLatestProcessamentosByCliente(processamentosQ.data?.processamentos ?? []),
    [processamentosQ.data?.processamentos]
  );

  const expiringByCliente = useMemo(
    () => expiringCertificatesByCliente(expiringQ.data?.certificados ?? []),
    [expiringQ.data?.certificados]
  );

  const certQueries = useQueries({
    queries: clienteIds.map((clienteId) => ({
      queryKey: ["fiscalCertClienteIndicator", clienteId],
      queryFn: () => fetchCertificadoDigital(clienteId),
      enabled,
      staleTime: 60_000
    }))
  });

  const procuracaoQueries = useQueries({
    queries: clienteIds.map((clienteId) => ({
      queryKey: ["fiscalProcuracaoClienteIndicator", clienteId],
      queryFn: () => fetchProcuracao(clienteId),
      enabled,
      staleTime: 60_000
    }))
  });

  const byClienteId = useMemo(() => {
    const map = new Map<string, ClienteFiscalIndicators>();
    clienteIds.forEach((clienteId, index) => {
      map.set(
        clienteId,
        buildClienteFiscalIndicators({
          certificado: certQueries[index]?.data?.certificado ?? null,
          expiring: expiringByCliente.get(clienteId),
          procuracao: procuracaoQueries[index]?.data?.procuracao ?? null,
          latestProcessamento: latestByCliente.get(clienteId) ?? null
        })
      );
    });
    return map;
  }, [clienteIds, certQueries, procuracaoQueries, latestByCliente, expiringByCliente]);

  const isLoading =
    enabled &&
    (processamentosQ.isLoading ||
      expiringQ.isLoading ||
      certQueries.some((q) => q.isLoading) ||
      procuracaoQueries.some((q) => q.isLoading));

  return { enabled, isLoading, byClienteId };
}
