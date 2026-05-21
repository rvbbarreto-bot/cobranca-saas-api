import { Link } from "react-router-dom";

export function AjudaProvisionamentoCorePage(): JSX.Element {
  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <h2 className="shell-page__title">Ajuda — provisionamento (core)</h2>
        <Link to="/escritorio" className="btn-secondary">
          Escritório
        </Link>
      </div>
      <div className="form-card form-card--full">
        <p className="muted">
          O portal opera com <code>automacao.tenants</code> e JWT portal. Já o endpoint{" "}
          <code>POST /v1/tenants/provision</code> vive na <strong>superfície core</strong> (header{" "}
          <code>x-tenant-id</code> com UUID de <code>public.tenants</code>, ex. <code>demo</code>) e exige papel{" "}
          <code>owner</code> ou <code>admin</code> no token core.
        </p>
        <h3 className="form-card__title">Exemplo (dev, com mock core ligado)</h3>
        <pre
          style={{
            background: "#0f172a",
            color: "#e2e8f0",
            padding: "1rem",
            borderRadius: 8,
            overflow: "auto",
            fontSize: "0.85rem"
          }}
        >
          {`# 1) Token core (tenant demo)
curl -s -X POST http://localhost:3333/v1/auth/token/mock \\
  -H "x-tenant-id: demo" | jq -r .access_token

# 2) Provisionar slug único
curl -s -X POST http://localhost:3333/v1/tenants/provision \\
  -H "Authorization: Bearer <TOKEN>" \\
  -H "x-tenant-id: demo" \\
  -H "Content-Type: application/json" \\
  -d '{"slug":"novo-escritorio","name":"Nome","status":"trial"}'`}
        </pre>
        <p className="muted small">
          Em produção: <code>ENABLE_MOCK_AUTH=false</code> — rotas mock retornam 404; obter token core pelo fluxo real da
          plataforma. Runbook ops:{" "}
          <code>docs/RUNBOOK_AUTH_PRODUCAO.md</code> no repositório <code>cobranca-saas-api</code>.
        </p>
      </div>
    </div>
  );
}
