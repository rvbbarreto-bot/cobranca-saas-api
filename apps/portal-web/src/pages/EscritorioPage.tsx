import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useState } from "react";
import {
  activateEscritorioAssinatura,
  ApiError,
  fetchCobrancas,
  fetchEscritorioAssinatura,
  fetchPortalMe
} from "../lib/api";

function fmtBrl(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function usagePct(used: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((used / max) * 100));
}

function activateErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const body = err.body as { error?: string; message?: string } | null;
    if (body && typeof body === "object" && body.error === "SUBSCRIPTION_ALREADY_ACTIVATED") {
      return "A cobrança recorrente já está ativa para este escritório.";
    }
    if (body && typeof body === "object" && body.error === "PLATFORM_BILLING_NOT_CONFIGURED") {
      return "Cobrança recorrente indisponível: configure ASAAS_PLATFORM_API_KEY no servidor.";
    }
    return err.message;
  }
  if (err instanceof Error) {
    return err.message;
  }
  return "Não foi possível ativar a assinatura.";
}

export function EscritorioPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [activateSuccess, setActivateSuccess] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["portalMe"], queryFn: fetchPortalMe, staleTime: 60_000 });
  const cob = useQuery({ queryKey: ["cobrancas"], queryFn: () => fetchCobrancas() });
  const assinatura = useQuery({
    queryKey: ["escritorioAssinatura"],
    queryFn: fetchEscritorioAssinatura,
    staleTime: 60_000,
    retry: (count, err) => {
      const status = err && typeof err === "object" && "status" in err ? (err as { status: number }).status : 0;
      if (status === 403 || status === 404) return false;
      return count < 1;
    }
  });

  const activate = useMutation({
    mutationFn: activateEscritorioAssinatura,
    onSuccess: (data) => {
      setActivateSuccess(data.activation.gatewaySubscriptionId);
      void queryClient.invalidateQueries({ queryKey: ["escritorioAssinatura"] });
    }
  });

  const sub = assinatura.data?.assinatura;
  const isAdmin = me.data?.user.membership_role === "admin_escritorio";
  const canActivate = isAdmin && sub && (sub.status === "trial" || sub.status === "past_due");

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <h2 className="shell-page__title">Escritório</h2>
        <Link to="/dashboard" className="btn-secondary">
          Dashboard
        </Link>
      </div>
      <p className="muted">Contexto do tenant portal, plano SaaS e ligação ao billing.</p>

      {assinatura.isLoading ? <p className="muted">A carregar assinatura…</p> : null}
      {assinatura.isError ? (
        <div className="banner-warn form-card--full">
          {assinatura.error instanceof Error
            ? assinatura.error.message
            : "Assinatura indisponível (requer admin_escritorio e vínculo billing)."}
        </div>
      ) : null}
      {sub ? (
        <div className="form-card form-card--full" style={{ marginTop: "1rem" }}>
          <h3 className="form-card__title">Plano e assinatura</h3>
          {sub.read_only ? (
            <div className="banner-warn" style={{ marginBottom: "0.75rem" }}>
              Conta em modo <strong>somente leitura</strong> — renove ou regularize a assinatura para criar clientes e
              cobranças.
            </div>
          ) : null}
          <p>
            <strong>Plano:</strong> {sub.plano.nome} (<code>{sub.plano.slug}</code>) — {fmtBrl(sub.plano.preco_mensal)}
            /mês
          </p>
          <p>
            <strong>Status:</strong> {sub.status}
            {sub.status === "trial" && sub.trial_ends_at ? (
              <>
                {" "}
                — trial até <strong>{fmtDate(sub.trial_ends_at)}</strong>
              </>
            ) : null}
          </p>
          {activateSuccess ? (
            <div className="banner-ok" style={{ marginBottom: "0.75rem" }}>
              Cobrança recorrente ativa. ID Asaas: <code>{activateSuccess}</code>
            </div>
          ) : null}
          {activate.isError ? (
            <div className="banner-err" style={{ marginBottom: "0.75rem" }}>
              {activateErrorMessage(activate.error)}
            </div>
          ) : null}
          {canActivate ? (
            <p style={{ marginTop: "0.75rem" }}>
              <button
                type="button"
                className="btn-primary"
                disabled={activate.isPending}
                onClick={() => {
                  setActivateSuccess(null);
                  activate.mutate();
                }}
              >
                {activate.isPending ? "A ativar…" : "Ativar cobrança recorrente"}
              </button>
              <span className="muted small" style={{ display: "block", marginTop: "0.35rem" }}>
                Cria a assinatura mensal no Asaas (cartão/boleto conforme configuração da plataforma).
              </span>
            </p>
          ) : null}
          {!isAdmin && sub.status === "trial" ? (
            <p className="muted small">Apenas <strong>admin_escritorio</strong> pode ativar a cobrança recorrente.</p>
          ) : null}
          <p className="muted small">
            Uso em <strong>{sub.uso.year_month}</strong>
          </p>
          <div className="dash-kpi-grid" style={{ marginTop: "0.75rem" }}>
            <div className="dash-kpi">
              <p className="dash-kpi__label">Clientes</p>
              <p className="dash-kpi__value">
                {sub.uso.clientes} / {sub.plano.max_clientes}
              </p>
              <p className="muted small">{usagePct(sub.uso.clientes, sub.plano.max_clientes)}% do limite</p>
            </div>
            <div className="dash-kpi">
              <p className="dash-kpi__label">Cobranças no mês</p>
              <p className="dash-kpi__value">
                {sub.uso.cobrancas_criadas_mes} / {sub.plano.max_cobrancas_mes}
              </p>
              <p className="muted small">
                {usagePct(sub.uso.cobrancas_criadas_mes, sub.plano.max_cobrancas_mes)}% do limite
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {me.isLoading ? <p className="muted">A carregar perfil…</p> : null}
      {me.isError ? (
        <div className="banner-warn">{me.error instanceof Error ? me.error.message : "Perfil indisponível"}</div>
      ) : null}
      {me.data ? (
        <div className="form-card form-card--full" style={{ marginTop: "1rem" }}>
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
            {cob.data.message ??
              "Sem vínculo em portal.billing_tenant_link. Configure migração 008 + registo para este escritório."}
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
