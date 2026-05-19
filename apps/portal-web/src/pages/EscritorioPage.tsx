import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchCobrancas, fetchPortalMe } from "../lib/api";

export function EscritorioPage(): JSX.Element {
  const me = useQuery({ queryKey: ["portalMe"], queryFn: fetchPortalMe, staleTime: 60_000 });
  const cob = useQuery({ queryKey: ["cobrancas"], queryFn: () => fetchCobrancas() });

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <h2 className="shell-page__title">Escritório</h2>
        <Link to="/dashboard" className="btn-secondary">
          Dashboard
        </Link>
      </div>
      <p className="muted">Contexto do tenant portal e ligação ao billing (fase 2 — operação).</p>

      {me.isLoading ? <p className="muted">A carregar perfil…</p> : null}
      {me.isError ? (
        <div className="banner-warn">{me.error instanceof Error ? me.error.message : "Perfil indisponível"}</div>
      ) : null}
      {me.data ? (
        <div className="form-card form-card--full">
          <h3 className="form-card__title">Identificação (API)</h3>
          <p>
            <strong>Tenant ID:</strong> <code>{me.data.tenant.id}</code>
          </p>
          <p>
            <strong>Slug:</strong> {me.data.tenant.slug ?? "—"}
          </p>
          <p>
            <strong>Papel:</strong> {me.data.user.membership_role}
          </p>
          <p>
            <strong>E-mail:</strong> {me.data.user.email ?? "—"}
          </p>
        </div>
      ) : null}

      <div className="form-card form-card--full" style={{ marginTop: "1rem" }}>
        <h3 className="form-card__title">Ligação billing → tenant público</h3>
        {cob.isLoading ? <p className="muted">A verificar…</p> : null}
        {cob.data?.billing_link_status === "missing" ? (
          <div className="banner-warn">
            {cob.data.message ?? "Sem vínculo em portal.billing_tenant_link. Configure migração 008 + registo para este escritório."}
          </div>
        ) : (
          <p className="muted">Ligação OK — pode criar cobranças pelo portal.</p>
        )}
      </div>

      <p className="muted small form-card--full" style={{ marginTop: "1rem" }}>
        <strong>Provisionamento de novo tenant público (core):</strong> requer JWT <code>owner</code> ou{" "}
        <code>admin</code> no core SaaS — ver exemplos em{" "}
        <Link to="/ajuda/provisionamento-core" className="link-inline">
          Ajuda → Core
        </Link>
        .
      </p>
    </div>
  );
}
