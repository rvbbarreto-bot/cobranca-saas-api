import { useMemo, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { FiscalAdminGate } from "../components/FiscalAdminGate";
import { PortalLoadMore } from "../components/PortalLoadMore";
import { ShellPageHeader } from "../components/ShellPageHeader";
import { fetchFiscalAuditLog } from "../lib/api";
import {
  buildFiscalAuditListQuery,
  FISCAL_AUDIT_ACTION_OPTIONS,
  fiscalAuditActionLabel,
  fiscalAuditResourceSummary,
  formatFiscalAuditDateTime,
  type FiscalAuditListFilters
} from "../lib/fiscal-audit-ui";

function AuditTable(): JSX.Element {
  const [filters, setFilters] = useState<FiscalAuditListFilters>({
    from: "",
    to: "",
    action: "",
    userId: ""
  });
  const [applied, setApplied] = useState<FiscalAuditListFilters>(filters);

  const q = useInfiniteQuery({
    queryKey: ["fiscalAudit", applied],
    queryFn: ({ pageParam }) =>
      fetchFiscalAuditLog(buildFiscalAuditListQuery(applied, pageParam as string | undefined)),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined
  });

  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.entries) ?? [], [q.data?.pages]);

  function applyFilters(): void {
    setApplied({ ...filters });
  }

  function clearFilters(): void {
    const empty = { from: "", to: "", action: "", userId: "" };
    setFilters(empty);
    setApplied(empty);
  }

  return (
    <>
      <div className="form-card fiscal-audit-filters" data-testid="fiscal-audit-filters">
        <div className="proto-toolbar" style={{ marginBottom: 0 }}>
          <label className="proto-toolbar__field field-label">
            De
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
              aria-label="Data inicial"
            />
          </label>
          <label className="proto-toolbar__field field-label">
            Até
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
              aria-label="Data final"
            />
          </label>
          <label className="proto-toolbar__field field-label">
            Ação
            <select
              value={filters.action}
              onChange={(e) => setFilters((f) => ({ ...f, action: e.target.value }))}
              aria-label="Filtrar por ação"
            >
              {FISCAL_AUDIT_ACTION_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="proto-toolbar__field field-label" style={{ minWidth: "10rem" }}>
            Usuário (ID)
            <input
              type="search"
              placeholder="ID parcial do usuário"
              value={filters.userId}
              onChange={(e) => setFilters((f) => ({ ...f, userId: e.target.value }))}
              aria-label="Filtrar por usuário"
            />
          </label>
          <div className="proto-toolbar__field" style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
            <button type="button" className="btn-primary" onClick={applyFilters}>
              Filtrar
            </button>
            <button type="button" className="btn-secondary" onClick={clearFilters}>
              Limpar
            </button>
          </div>
        </div>
      </div>

      {q.isLoading ? <p className="muted">A carregar auditoria…</p> : null}
      {q.isError ? (
        <div className="banner-err" role="alert">
          {q.error instanceof Error ? q.error.message : "Erro ao carregar auditoria fiscal."}
        </div>
      ) : null}

      {q.data ? (
        <>
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="table" data-testid="fiscal-audit-table">
              <thead>
                <tr>
                  <th>Quando</th>
                  <th>Ação</th>
                  <th>Usuário</th>
                  <th>Recurso</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Nenhum evento encontrado para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td>{formatFiscalAuditDateTime(row.created_at)}</td>
                      <td>{fiscalAuditActionLabel(row.action)}</td>
                      <td>{row.user_id ?? "—"}</td>
                      <td title={row.resource_id}>{fiscalAuditResourceSummary(row)}</td>
                      <td>{row.ip_address ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PortalLoadMore
            hasMore={Boolean(q.hasNextPage)}
            loading={q.isFetchingNextPage}
            onLoadMore={() => void q.fetchNextPage()}
            loadedCount={rows.length}
          />
        </>
      ) : null}
    </>
  );
}

export function FiscalAuditoriaPage(): JSX.Element {
  return (
    <FiscalAdminGate
      title="Auditoria fiscal"
      description="Trilha read-only de eventos do módulo fiscal — downloads, certificados, capturas e validações SERPRO."
    >
      <AuditTable />
    </FiscalAdminGate>
  );
}
