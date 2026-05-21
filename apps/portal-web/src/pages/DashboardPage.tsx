import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchEscritorioDashboard } from "../lib/api";

function fmtBrl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function DashboardPage(): JSX.Element {
  const q = useQuery({
    queryKey: ["escritorioDashboard", "30d"],
    queryFn: () => fetchEscritorioDashboard("30d")
  });

  const c = q.data?.cobrancas;
  const por = c?.por_status ?? {};

  return (
    <div>
      <div className="shell-page__head" style={{ marginBottom: "1rem" }}>
        <h2 className="shell-page__title">Dashboard do escritório</h2>
        {q.data ? (
          <p className="muted small">
            Período: {q.data.periodo.inicio} — {q.data.periodo.fim}
          </p>
        ) : null}
      </div>

      {q.isLoading ? <p className="muted">A carregar indicadores…</p> : null}
      {q.isError ? <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro"}</div> : null}

      {c ? (
        <>
          <div className="dash-kpi-grid">
            <div className="dash-kpi">
              <p className="dash-kpi__label">Cobranças no período</p>
              <p className="dash-kpi__value">{c.total}</p>
            </div>
            <div className="dash-kpi">
              <p className="dash-kpi__label">Pagas</p>
              <p className="dash-kpi__value">{por.paga ?? 0}</p>
            </div>
            <div className="dash-kpi">
              <p className="dash-kpi__label">Valor recebido</p>
              <p className="dash-kpi__value">{fmtBrl(c.valor_total_recebido)}</p>
            </div>
            <div className="dash-kpi">
              <p className="dash-kpi__label">Taxa de conversão</p>
              <p className="dash-kpi__value">{c.taxa_conversao.toFixed(1)}%</p>
            </div>
          </div>

          <div className="dash-panel" style={{ marginTop: "1.5rem" }}>
            <h2 className="dash-panel__title">Por status</h2>
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {Object.entries(por).map(([status, count]) => (
                    <tr key={status}>
                      <td>{status}</td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(q.data?.top_clientes_inadimplentes.length ?? 0) > 0 ? (
            <div className="dash-panel" style={{ marginTop: "1rem" }}>
              <h2 className="dash-panel__title">Top inadimplentes</h2>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Documento</th>
                      <th>Valor vencido</th>
                      <th>Qtd.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(q.data?.top_clientes_inadimplentes ?? []).map((row) => (
                      <tr key={row.documento_mascarado + row.nome}>
                        <td>{row.nome}</td>
                        <td>{row.documento_mascarado}</td>
                        <td>{fmtBrl(row.valor_vencido)}</td>
                        <td>{row.qtd_cobr_vencidas}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <h3 className="shell-page__title" style={{ marginTop: "1.75rem", fontSize: "1.05rem" }}>
        Atalhos
      </h3>
      <div className="dash-quick">
        <Link to="/clientes" className="dash-card">
          <div className="dash-card__title">Clientes</div>
        </Link>
        <Link to="/cobrancas" className="dash-card">
          <div className="dash-card__title">Boletos</div>
        </Link>
        <Link to="/relatorios" className="dash-card">
          <div className="dash-card__title">Relatórios CSV</div>
        </Link>
      </div>
    </div>
  );
}
