import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { FiscalSectionNav } from "../components/FiscalSectionNav";
import { PortalLoadMore } from "../components/PortalLoadMore";
import { ShellPageHeader } from "../components/ShellPageHeader";
import { fetchGuiasFiscais } from "../lib/api";
import {
  buildGuiasFiscaisListQuery,
  guiaFiscalComplianceLabel,
  guiaFiscalCompliancePillClass,
  guiaFiscalStatusLabel,
  guiaFiscalStatusPillClass,
  isValidCompetenciaFilter,
  tipoGuiaPillClass,
  tipoGuiaShortLabel,
  TIPO_GUIA_FILTER_OPTIONS,
  type TipoGuiaFiltro
} from "../lib/guia-fiscal-ui";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PAGE_SIZE = 50;

function fmtMoney(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) {
    return "—";
  }
  return money.format(v);
}

export function GuiasFiscaisPage(): JSX.Element {
  const [tipoFilter, setTipoFilter] = useState<TipoGuiaFiltro>("");
  const [competenciaFilter, setCompetenciaFilter] = useState("");
  const competenciaApplied =
    competenciaFilter.trim() && isValidCompetenciaFilter(competenciaFilter)
      ? competenciaFilter.trim()
      : "";

  const q = useInfiniteQuery({
    queryKey: ["guiasFiscais", tipoFilter, competenciaApplied],
    queryFn: ({ pageParam }) =>
      fetchGuiasFiscais(
        buildGuiasFiscaisListQuery({
          limit: PAGE_SIZE,
          cursor: pageParam as string | undefined,
          tipoGuia: tipoFilter,
          competencia: competenciaApplied
        })
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined
  });

  const rows = useMemo(() => q.data?.pages.flatMap((p) => p.guias) ?? [], [q.data?.pages]);
  const competenciaInvalid =
    competenciaFilter.trim().length > 0 && !isValidCompetenciaFilter(competenciaFilter);

  return (
    <div className="shell-page">
      <ShellPageHeader
        title="Guias fiscais (DAS / DARF)"
        description="Listagem via GET /v1/portal/fiscal/guias — captura via n8n + inbox."
        actions={<FiscalSectionNav />}
      />

      <div className="form-card" style={{ marginBottom: "1rem", display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        <label className="field-label" style={{ margin: 0, minWidth: "10rem" }}>
          Tipo de guia
          <select
            value={tipoFilter}
            onChange={(e) => setTipoFilter(e.target.value as TipoGuiaFiltro)}
            aria-label="Filtrar por tipo de guia"
          >
            {TIPO_GUIA_FILTER_OPTIONS.map((o) => (
              <option key={o.value || "all"} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label" style={{ margin: 0, minWidth: "10rem" }}>
          Competência (YYYY-MM)
          <input
            type="month"
            value={competenciaFilter}
            onChange={(e) => setCompetenciaFilter(e.target.value)}
            aria-label="Filtrar por competência"
          />
        </label>
        {competenciaApplied || tipoFilter ? (
          <button
            type="button"
            className="btn-secondary"
            style={{ alignSelf: "flex-end" }}
            onClick={() => {
              setTipoFilter("");
              setCompetenciaFilter("");
            }}
          >
            Limpar filtros
          </button>
        ) : null}
      </div>
      {competenciaInvalid ? (
        <p className="form-error">Competência inválida — use o formato YYYY-MM.</p>
      ) : null}

      {q.isLoading ? <p className="muted">Carregando…</p> : null}
      {q.isError ? (
        <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro ao carregar"}</div>
      ) : null}

      {q.data && !q.isLoading && !competenciaInvalid ? (
        <div className="table-wrap">
          {rows.length === 0 ? (
            <p className="muted padded">Nenhuma guia fiscal para os filtros selecionados.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Competência</th>
                  <th>Tipo</th>
                  <th>Valor total</th>
                  <th>Status</th>
                  <th>Compliance</th>
                  <th>Vencimento</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.competencia}</td>
                    <td>
                      <span className={tipoGuiaPillClass(row.tipo_guia)}>{tipoGuiaShortLabel(row.tipo_guia)}</span>
                    </td>
                    <td>{fmtMoney(row.valor_total)}</td>
                    <td>
                      <span className={guiaFiscalStatusPillClass(row.status)}>
                        {guiaFiscalStatusLabel(row.status)}
                      </span>
                    </td>
                    <td>
                      <span className={guiaFiscalCompliancePillClass(row.compliance_status)}>
                        {guiaFiscalComplianceLabel(row.compliance_status)}
                      </span>
                    </td>
                    <td>{row.data_vencimento ?? "—"}</td>
                    <td>
                      <Link to={`/guias-fiscais/${row.id}`}>Detalhe</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <PortalLoadMore
            hasMore={Boolean(q.hasNextPage)}
            loading={q.isFetchingNextPage}
            onLoadMore={() => void q.fetchNextPage()}
            loadedCount={rows.length}
          />
        </div>
      ) : null}
    </div>
  );
}
