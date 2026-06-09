import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ShellPageHeader } from "../components/ShellPageHeader";
import { useAuth } from "../hooks/useAuth";
import { fetchFiscalDashboard } from "../lib/api";
import {
  formatCompetenciaLabel,
  processamentoStatusLabel,
  processamentoStatusPillClass
} from "../lib/processamento-fiscal-ui";

export function FiscalDashboardPage(): JSX.Element {
  const { email } = useAuth();
  const q = useQuery({
    queryKey: ["fiscalDashboard"],
    queryFn: fetchFiscalDashboard
  });

  const kpis = q.data?.kpis;
  const competenciaLabel = q.data ? formatCompetenciaLabel(q.data.competencia_atual) : null;

  return (
    <div className="fiscal-dash">
      <ShellPageHeader
        title="Dashboard fiscal"
        description={
          competenciaLabel
            ? `Competência atual: ${competenciaLabel}`
            : "Indicadores operacionais PGDASD e certificados"
        }
      />

      {email ? (
        <p className="fiscal-dash__greeting muted" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
          Olá, {email.split("@")[0]}
        </p>
      ) : null}

      {q.isLoading ? <p className="muted">A carregar indicadores…</p> : null}
      {q.isError ? (
        <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro ao carregar dashboard"}</div>
      ) : null}

      {kpis ? (
        <>
          <div className="dash-kpi-grid fiscal-dash__kpis">
            <div className="dash-kpi">
              <p className="dash-kpi__label">Processamentos no mês</p>
              <p className="dash-kpi__value">{kpis.processamentos_mes}</p>
            </div>
            <div className="dash-kpi">
              <p className="dash-kpi__label">Erros abertos</p>
              <p className="dash-kpi__value">{kpis.erros_abertos}</p>
              {kpis.erros_abertos > 0 ? (
                <span className="dash-kpi__badge dash-kpi__badge--red">Atenção</span>
              ) : null}
            </div>
            <div className="dash-kpi">
              <p className="dash-kpi__label">Certificados expirando</p>
              <p className="dash-kpi__value">{kpis.certificados_expirando}</p>
              {kpis.certificados_expirando > 0 ? (
                <span className="dash-kpi__badge dash-kpi__badge--orange">30 dias</span>
              ) : null}
            </div>
          </div>

          <div className="fiscal-dash__cta">
            <Link to="/processamentos-fiscais/importar" className="btn btn--primary">
              Enviar arquivo CSV
            </Link>
          </div>

          {(q.data?.ultimos_processamentos.length ?? 0) > 0 ? (
            <div className="dash-panel fiscal-dash__recent">
              <h2 className="dash-panel__title">Últimos processamentos</h2>
              <p className="dash-panel__sub">Competência, status e link para detalhe</p>
              <ul className="fiscal-dash__list">
                {(q.data?.ultimos_processamentos ?? []).map((row) => (
                  <li key={row.id} className="fiscal-dash__list-item">
                    <Link to={`/processamentos-fiscais/${row.id}`} className="fiscal-dash__list-link">
                      <span className="fiscal-dash__list-main">
                        {formatCompetenciaLabel(row.competencia)} — {processamentoStatusLabel(row.status)}
                      </span>
                      <span className={`status-pill ${processamentoStatusPillClass(row.status)}`}>
                        {processamentoStatusLabel(row.status)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <Link to="/processamentos-fiscais" className="fiscal-dash__all-link">
                Ver todos os processamentos
              </Link>
            </div>
          ) : null}

          {(q.data?.certificados_expirando.length ?? 0) > 0 ? (
            <div className="dash-panel fiscal-dash__certs" style={{ marginTop: "1rem" }}>
              <h2 className="dash-panel__title">Certificados a vencer</h2>
              <ul className="fiscal-dash__list">
                {(q.data?.certificados_expirando ?? []).map((cert) => (
                  <li key={cert.id} className="fiscal-dash__list-item">
                    <span>
                      {cert.label} — vence em {cert.days_left} dia(s)
                    </span>
                  </li>
                ))}
              </ul>
              <Link to="/fiscal/certificados" className="fiscal-dash__all-link">
                Gerenciar certificados
              </Link>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
