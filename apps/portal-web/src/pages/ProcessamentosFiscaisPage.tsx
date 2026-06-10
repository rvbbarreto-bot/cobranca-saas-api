import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ProcessamentoErroCentralPanel } from "../components/ProcessamentoErroCentralPanel";
import { ShellPageHeader } from "../components/ShellPageHeader";
import { fetchClientes, fetchProcessamentosFiscais } from "../lib/api";
import { isValidCompetenciaFilter } from "../lib/guia-fiscal-ui";
import {
  countProcessamentosComErro,
  filterProcessamentoRows,
  groupProcessamentosByErro,
  PROCESSAMENTO_STATUS_FILTER_OPTIONS,
  processamentoErroHelp,
  processamentoStatusLabel,
  processamentoStatusPillClass,
  processamentoTemErro,
  type ProcessamentoListFilters
} from "../lib/processamento-fiscal-ui";

export type ProcessamentosListView = "historico" | "erros";

type ListView = ProcessamentosListView;

export type ProcessamentosFiscaisPageProps = {
  initialView?: ListView;
};

function formatDocBR(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

export function ProcessamentosFiscaisPage({ initialView = "historico" }: ProcessamentosFiscaisPageProps = {}): JSX.Element {
  const [view, setView] = useState<ListView>(initialView);
  const [competenciaFilter, setCompetenciaFilter] = useState("");
  const [clienteFilter, setClienteFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [somenteComErro, setSomenteComErro] = useState(false);

  const competenciaApplied =
    competenciaFilter.trim() && isValidCompetenciaFilter(competenciaFilter) ? competenciaFilter.trim() : "";

  const filters: ProcessamentoListFilters = {
    competencia: competenciaApplied || undefined,
    portalClienteId: clienteFilter || undefined,
    status: statusFilter || undefined,
    somenteComErro: somenteComErro || undefined
  };

  const q = useQuery({
    queryKey: ["processamentosFiscais"],
    queryFn: () => fetchProcessamentosFiscais()
  });

  const clientesQ = useQuery({
    queryKey: ["clientes", "processamentos-filter"],
    queryFn: () => fetchClientes({ limit: 200 })
  });

  const allRows = q.data?.processamentos ?? [];
  const filteredRows = useMemo(() => filterProcessamentoRows(allRows, filters), [allRows, filters]);
  const erroGroups = useMemo(() => groupProcessamentosByErro(allRows), [allRows]);
  const erroCount = countProcessamentosComErro(allRows);

  const clienteLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clientesQ.data?.data ?? []) {
      map[c.id] = `${c.nome} (${formatDocBR(c.documento)})`;
    }
    return map;
  }, [clientesQ.data?.data]);

  const competenciaInvalid =
    competenciaFilter.trim().length > 0 && !isValidCompetenciaFilter(competenciaFilter);

  function clearFilters(): void {
    setCompetenciaFilter("");
    setClienteFilter("");
    setStatusFilter("");
    setSomenteComErro(false);
  }

  const hasActiveFilters = Boolean(competenciaApplied || clienteFilter || statusFilter || somenteComErro);

  return (
    <div className="shell-page fiscal-surface">
      <ShellPageHeader
        title="Processamentos PGDASD"
        description="Histórico de transmissões e central de erros SERPRO."
        actions={
          <Link to="/processamentos-fiscais/importar" className="btn-primary">
            Importar CSV
          </Link>
        }
      />

      <div className="tabs" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        <button
          type="button"
          className={view === "historico" ? "tab tab--active" : "tab"}
          onClick={() => setView("historico")}
          data-testid="proc-tab-historico"
        >
          Histórico
        </button>
        <button
          type="button"
          className={view === "erros" ? "tab tab--active" : "tab"}
          onClick={() => setView("erros")}
          data-testid="proc-tab-erros"
        >
          Central de erros{erroCount > 0 ? ` (${erroCount})` : ""}
        </button>
      </div>

      {view === "historico" ? (
        <>
          <div
            className="form-card"
            style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "1rem" }}
            data-testid="proc-filters"
          >
            <label className="field-label" style={{ margin: 0, minWidth: "10rem" }}>
              Competência
              <input
                type="month"
                value={competenciaFilter}
                onChange={(e) => setCompetenciaFilter(e.target.value)}
                aria-label="Filtrar por competência"
              />
            </label>
            <label className="field-label" style={{ margin: 0, minWidth: "14rem" }}>
              Empresa
              <select
                value={clienteFilter}
                onChange={(e) => setClienteFilter(e.target.value)}
                aria-label="Filtrar por empresa"
              >
                <option value="">Todas as empresas</option>
                {(clientesQ.data?.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} — {formatDocBR(c.documento)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label" style={{ margin: 0, minWidth: "12rem" }}>
              Status
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filtrar por status"
              >
                {PROCESSAMENTO_STATUS_FILTER_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label" style={{ margin: 0, alignSelf: "flex-end", display: "flex", gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={somenteComErro}
                onChange={(e) => setSomenteComErro(e.target.checked)}
                data-testid="proc-filter-somente-erro"
              />
              Somente com erro
            </label>
            {hasActiveFilters ? (
              <button type="button" className="btn-secondary" style={{ alignSelf: "flex-end" }} onClick={clearFilters}>
                Limpar filtros
              </button>
            ) : null}
          </div>

          {competenciaInvalid ? (
            <p className="form-error">Competência inválida — use o formato YYYY-MM.</p>
          ) : null}

          {q.isLoading ? <p className="muted">A carregar…</p> : null}
          {q.isError ? (
            <p className="form-error" role="alert">
              {q.error instanceof Error ? q.error.message : "Erro ao listar processamentos."}
            </p>
          ) : null}

          {!q.isLoading && filteredRows.length === 0 ? (
            <div className="form-card">
              <p className="muted">
                {allRows.length === 0
                  ? "Nenhum processamento fiscal ainda."
                  : "Nenhum processamento corresponde aos filtros."}
              </p>
            </div>
          ) : null}

          {filteredRows.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table" data-testid="proc-historico-table">
                <thead>
                  <tr>
                    <th>Competência</th>
                    <th>Empresa</th>
                    <th>Status</th>
                    <th>Erro</th>
                    <th>Protocolo</th>
                    <th>Guia DAS</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const erroHelp = row.erro_codigo ? processamentoErroHelp(row.erro_codigo) : null;
                    return (
                      <tr key={row.id}>
                        <td>{row.competencia}</td>
                        <td>{clienteLabels[row.portal_cliente_id] ?? "—"}</td>
                        <td>
                          <span className={`status-pill ${processamentoStatusPillClass(row.status)}`}>
                            {processamentoStatusLabel(row.status)}
                          </span>
                        </td>
                        <td>
                          {processamentoTemErro(row) ? (
                            <span className="muted" title={erroHelp?.sugestao}>
                              {erroHelp?.titulo ?? row.erro_codigo ?? "Erro"}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>{row.protocolo_serpro ?? "—"}</td>
                        <td>
                          {row.guia_fiscal_id ? (
                            <Link
                              to={`/guias-fiscais/${row.guia_fiscal_id}?processamento=${row.id}`}
                            >
                              Ver guia
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <Link to={`/processamentos-fiscais/${row.id}`}>Detalhe</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : (
        <>
          {q.isLoading ? <p className="muted">A carregar…</p> : null}
          <ProcessamentoErroCentralPanel groups={erroGroups} clienteLabels={clienteLabels} />
        </>
      )}
    </div>
  );
}
