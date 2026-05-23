import { useQuery } from "@tanstack/react-query";
import { fetchClienteById } from "../lib/api";
import { clienteDetailQueryKey } from "../lib/cliente-query-keys";

export function useCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: clienteDetailQueryKey(clienteId ?? ""),
    queryFn: () => fetchClienteById(clienteId!),
    enabled: Boolean(clienteId?.trim()),
    staleTime: 60_000
  });
}
