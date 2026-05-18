import { Link } from "react-router-dom";

function SparkTeal(): JSX.Element {
  return (
    <svg className="dash-kpi__spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 28 L20 22 L40 26 L60 10 L80 18 L100 8 L120 14"
        fill="none"
        stroke="url(#g1)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id="g1" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function SparkOrange(): JSX.Element {
  return (
    <svg className="dash-kpi__spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 20 L25 26 L50 12 L75 24 L100 8 L120 18"
        fill="none"
        stroke="#fb923c"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkRed(): JSX.Element {
  return (
    <svg className="dash-kpi__spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 14 L30 28 L55 10 L80 24 L110 16 L120 26"
        fill="none"
        stroke="#f87171"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SparkGreen(): JSX.Element {
  return (
    <svg className="dash-kpi__spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden>
      <path
        d="M0 26 L22 18 L44 22 L66 8 L88 14 L110 6 L120 10"
        fill="none"
        stroke="#4ade80"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DashboardPage(): JSX.Element {
  return (
    <div>
      <div className="dash-kpi-grid">
        <div className="dash-kpi">
          <p className="dash-kpi__label">Boletos emitidos no mês</p>
          <p className="dash-kpi__value">1.284</p>
          <SparkTeal />
          <span className="dash-kpi__badge dash-kpi__badge--teal">+8,4%</span>
        </div>
        <div className="dash-kpi">
          <p className="dash-kpi__label">Vencendo em 3 dias</p>
          <p className="dash-kpi__value">93</p>
          <SparkOrange />
          <span className="dash-kpi__badge dash-kpi__badge--orange">Ação agora</span>
        </div>
        <div className="dash-kpi">
          <p className="dash-kpi__label">Inadimplentes</p>
          <p className="dash-kpi__value">27</p>
          <SparkRed />
          <span className="dash-kpi__badge dash-kpi__badge--red">Cobrança</span>
        </div>
        <div className="dash-kpi">
          <p className="dash-kpi__label">Pagos hoje</p>
          <p className="dash-kpi__value">41</p>
          <SparkGreen />
          <span className="dash-kpi__badge dash-kpi__badge--green">+12 registros</span>
        </div>
      </div>

      <div className="dash-mid">
        <div className="dash-panel">
          <h2 className="dash-panel__title">Mapa operacional</h2>
          <p className="dash-panel__sub">Eventos e prazos críticos do dia (ilustração — integração em roadmap).</p>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Evento</th>
                  <th>Prazo</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>ACME Contábil</td>
                  <td>Lembrete D-2</td>
                  <td>Hoje 10:00</td>
                  <td>
                    <span className="status-pill status-pill--programado">Em fila</span>
                  </td>
                </tr>
                <tr>
                  <td>Vita Saúde</td>
                  <td>Falha no envio</td>
                  <td>Hoje 10:30</td>
                  <td>
                    <span className="status-pill status-pill--falha">Reprocessar</span>
                  </td>
                </tr>
                <tr>
                  <td>Clínica Orion</td>
                  <td>Cancelamento solicitado</td>
                  <td>Hoje 11:00</td>
                  <td>
                    <span className="status-pill status-pill--emitida">Aprovação</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="dash-panel">
          <h2 className="dash-panel__title">Indicadores</h2>
          <p className="dash-panel__sub">Visão consolidada de emissão e ciclo (mock visual).</p>
          <div className="dash-chart-placeholder" style={{ flexDirection: "column", gap: "1rem" }}>
            <svg viewBox="0 0 200 120" width="200" height="120" aria-hidden>
              <text x="100" y="58" textAnchor="middle" fontSize="28" fontWeight="800" fill="#0f172a">
                96,2%
              </text>
              <text x="100" y="82" textAnchor="middle" fontSize="11" fill="#64748b">
                sucesso de emissão
              </text>
              <path
                d="M 30 100 A 70 70 0 0 1 170 100"
                fill="none"
                stroke="#e0f2fe"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <path
                d="M 30 100 A 70 70 0 0 1 150 40"
                fill="none"
                stroke="#22d3ee"
                strokeWidth="14"
                strokeLinecap="round"
              />
            </svg>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center", fontSize: "0.8rem" }}>
              <span>
                <strong style={{ color: "#0d9488" }}>Emitido</strong> 88
              </span>
              <span>
                <strong style={{ color: "#2563eb" }}>Enviado</strong> 84
              </span>
              <span>
                <strong style={{ color: "#16a34a" }}>Pago</strong> 71
              </span>
              <span>
                <strong style={{ color: "#dc2626" }}>Vencido</strong> 11
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-line-panel">
        <h2 className="dash-panel__title">Visão financeira do período</h2>
        <p className="dash-panel__sub">Receita reconhecida e produtividade operacional (mock).</p>
        <svg className="dash-line-chart" viewBox="0 0 800 180" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="rgba(34,211,238,0.35)" />
              <stop offset="100%" stopColor="rgba(34,211,238,0)" />
            </linearGradient>
          </defs>
          <path
            d="M0 140 Q120 100 200 120 T400 80 T600 95 T800 50 L800 180 L0 180 Z"
            fill="url(#lg)"
          />
          <path
            d="M0 140 Q120 100 200 120 T400 80 T600 95 T800 50"
            fill="none"
            stroke="#14b8a6"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {[0, 200, 400, 600, 800].map((x) => (
            <circle key={x} cx={x} cy={x === 0 ? 140 : x === 200 ? 120 : x === 400 ? 80 : x === 600 ? 95 : 50} r="5" fill="#fff" stroke="#14b8a6" strokeWidth="2" />
          ))}
        </svg>
      </div>

      <h3 className="shell-page__title" style={{ marginTop: "1.75rem", fontSize: "1.05rem" }}>
        Atalhos
      </h3>
      <p className="shell-page__desc" style={{ marginBottom: "0.65rem" }}>
        Acesso rápido às áreas ligadas à API do portal.
      </p>
      <div className="dash-quick">
        <Link to="/clientes" className="dash-card">
          <div className="dash-card__title">Clientes</div>
          <p className="dash-card__desc">Cadastro e edição</p>
        </Link>
        <Link to="/cobrancas" className="dash-card">
          <div className="dash-card__title">Boletos</div>
          <p className="dash-card__desc">Lista e detalhe</p>
        </Link>
        <Link to="/cobrancas/nova" className="dash-card">
          <div className="dash-card__title">Nova cobrança</div>
          <p className="dash-card__desc">Emissão no tenant público</p>
        </Link>
        <Link to="/notas-fiscais" className="dash-card">
          <div className="dash-card__title">Notas fiscais</div>
          <p className="dash-card__desc">Resumo por escritório</p>
        </Link>
        <Link to="/relatorios" className="dash-card">
          <div className="dash-card__title">Relatórios</div>
          <p className="dash-card__desc">Export CSV</p>
        </Link>
        <Link to="/escritorio" className="dash-card">
          <div className="dash-card__title">Escritório</div>
          <p className="dash-card__desc">Tenant e billing link</p>
        </Link>
      </div>
    </div>
  );
}
