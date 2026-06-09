import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ExeqModulePills } from "../components/exeq/ExeqModulePills";
import { ExeqStatusBadge } from "../components/exeq/ExeqStatusBadge";
import { fetchEscritorios } from "../lib/exeq-api";

export function ExeqEscritoriosPage(): JSX.Element {
  const q = useQuery({ queryKey: ["exeqEscritorios"], queryFn: fetchEscritorios });

  const activeCount = q.data?.data.filter((r) => r.active).length ?? 0;
  const inactiveCount = (q.data?.data.length ?? 0) - activeCount;

  return (
    <div className="exeq-page">
      <div className="exeq-page__header">
        <div>
          <h2 className="exeq-page__title">Escritórios</h2>
          <p className="exeq-page__subtitle">
            Gerencie tenants, módulos contratados e acesso dos administradores locais.
          </p>
        </div>
        <Link to="/exeq/escritorios/novo" className="exeq-btn exeq-btn--primary">
          + Novo escritório
        </Link>
      </div>

      {q.data ? (
        <div className="exeq-stats-row">
          <div className="exeq-stat-card">
            <span className="exeq-stat-card__value">{q.data.count}</span>
            <span className="exeq-stat-card__label">Total</span>
          </div>
          <div className="exeq-stat-card exeq-stat-card--ok">
            <span className="exeq-stat-card__value">{activeCount}</span>
            <span className="exeq-stat-card__label">Ativos</span>
          </div>
          <div className="exeq-stat-card exeq-stat-card--warn">
            <span className="exeq-stat-card__value">{inactiveCount}</span>
            <span className="exeq-stat-card__label">Inativos</span>
          </div>
        </div>
      ) : null}

      {q.isLoading ? <div className="exeq-loading">Carregando escritórios…</div> : null}
      {q.isError ? (
        <div className="exeq-alert exeq-alert--error" role="alert">
          {q.error instanceof Error ? q.error.message : "Erro ao listar"}
        </div>
      ) : null}

      {q.data?.data.length === 0 ? (
        <div className="exeq-empty-card">
          <h3>Nenhum escritório cadastrado</h3>
          <p>Crie o primeiro tenant para liberar acesso ao portal multiempresa.</p>
          <Link to="/exeq/escritorios/novo" className="exeq-btn exeq-btn--primary">
            Provisionar escritório
          </Link>
        </div>
      ) : null}

      {q.data && q.data.data.length > 0 ? (
        <div className="exeq-card exeq-card--flush">
          <table className="exeq-data-table">
            <thead>
              <tr>
                <th>Escritório</th>
                <th>Tenant</th>
                <th>Status</th>
                <th>Equipe</th>
                <th>Módulos</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {q.data.data.map((row) => (
                <tr key={row.automacaoTenantId} className={!row.active ? "exeq-data-table__row--muted" : ""}>
                  <td>
                    <div className="exeq-cell-title">{row.name ?? "—"}</div>
                  </td>
                  <td>
                    <code className="exeq-code">{row.slug ?? row.automacaoTenantId}</code>
                  </td>
                  <td>
                    <ExeqStatusBadge active={row.active} billingStatus={row.publicTenantStatus} />
                  </td>
                  <td>
                    <span className="exeq-meta-inline">
                      {row.adminCount} admin · {row.operadorCount} op.
                    </span>
                  </td>
                  <td>
                    <ExeqModulePills modules={row.modules} compact />
                  </td>
                  <td className="exeq-data-table__actions">
                    <Link
                      to={`/exeq/escritorios/${encodeURIComponent(row.automacaoTenantId)}`}
                      className="exeq-btn exeq-btn--ghost exeq-btn--sm"
                    >
                      Gerenciar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
