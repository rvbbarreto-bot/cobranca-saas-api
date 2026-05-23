import type { QueryClient } from "@tanstack/react-query";

/** Chaves de cache separadas: lista infinita vs. detalhe de um cliente. */

export const CLIENTES_LIST_QUERY_KEY = ["clientes", "list"] as const;

export function clienteDetailQueryKey(id: string): readonly ["cliente", string] {
  return ["cliente", id] as const;
}

/** Invalida lista e fichas individuais apos criar/editar cliente. */
export async function invalidateClientesQueries(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: ["clientes"] });
  await qc.invalidateQueries({ queryKey: ["cliente"] });
}
