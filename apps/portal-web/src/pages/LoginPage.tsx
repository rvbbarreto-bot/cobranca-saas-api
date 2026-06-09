import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useExeqAuth } from "../hooks/useExeqAuth";
import { portalLogin, type UnifiedLoginTenantOption, clearSession, hasSession } from "../lib/api";
import { clearExeqSession, hasExeqSession } from "../lib/exeq-api";
import { loginFormBaseSchema } from "../lib/schemas";

function tenantLabel(t: UnifiedLoginTenantOption): string {
  const name = t.name?.trim() || t.slug?.trim() || t.automacao_tenant_id;
  const slug = t.slug ? ` (${t.slug})` : "";
  const role = t.role === "admin_escritorio" ? "Admin" : "Operador";
  return `${name}${slug} · ${role}`;
}

export function LoginPage(): JSX.Element {
  const qc = useQueryClient();
  const { isAuthenticated: portalAuth, establishSession: establishPortalSession } = useAuth();
  const { isAuthenticated: exeqAuth, establishSession: establishExeqSession } = useExeqAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tenantChoices, setTenantChoices] = useState<UnifiedLoginTenantOption[] | null>(null);
  const [selectedTenant, setSelectedTenant] = useState("");

  if (exeqAuth || hasExeqSession()) {
    return <Navigate to="/exeq/escritorios" replace />;
  }
  if (portalAuth || hasSession()) {
    return <Navigate to="/dashboard" replace />;
  }

  async function submitLogin(tenantOverride?: string): Promise<void> {
    setError(null);
    const parsed = loginFormBaseSchema.safeParse({ email, password });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0];
        if (typeof k === "string" && !fe[k]) {
          fe[k] = issue.message;
        }
      }
      setFieldErrors(fe);
      return;
    }
    setFieldErrors({});
    setIsSubmitting(true);

    const tenant = (tenantOverride ?? tenantId).trim() || undefined;

    try {
      const result = await portalLogin({
        email: parsed.data.email,
        password: parsed.data.password,
        tenant_id: tenant
      });

      if (result.kind === "tenant_selection_required") {
        setTenantChoices(result.tenants);
        if (result.tenants.length > 0) {
          const first = result.tenants[0]!;
          setSelectedTenant(first.slug ?? first.automacao_tenant_id);
        }
        return;
      }

      if (result.kind === "platform_master") {
        clearSession();
        establishExeqSession(result.access_token, parsed.data.email);
        await qc.invalidateQueries();
        navigate("/exeq/escritorios", { replace: true });
        return;
      }

      clearExeqSession();
      establishPortalSession(result.access_token, result.tenant_id, parsed.data.email);
      await qc.invalidateQueries();
      navigate("/dashboard", { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha no login");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    if (tenantChoices) {
      if (!selectedTenant) {
        setError("Selecione o escritório.");
        return;
      }
      await submitLogin(selectedTenant);
      return;
    }
    await submitLogin();
  }

  function backToCredentials(): void {
    setTenantChoices(null);
    setSelectedTenant("");
    setError(null);
  }

  return (
    <div className="login-layout">
      <div className="login-brand">
        <h1 className="login-brand__logo">EXEQ</h1>
        <p className="login-brand__tag">Cobrança & Boletos</p>
        <p className="login-brand__lead">
          Um único acesso para operadores EXEQ e equipes dos escritórios. Master provisiona tenants; admins operam
          cobrança, clientes e fiscal conforme módulos contratados.
        </p>
        <p className="login-brand__sub">
          Master EXEQ: deixe o escritório em branco. Vários escritórios: escolha após validar a senha.
        </p>
      </div>
      <div className="login-panel">
        <div className="login-card">
          <h2 className="login-card__title">{tenantChoices ? "Escolha o escritório" : "Entrar"}</h2>
          <p className="login-card__subtitle">
            {tenantChoices
              ? `O e-mail ${email} tem acesso a mais de um escritório.`
              : "E-mail e senha — escritório opcional"}
          </p>
          <form onSubmit={(e) => void onSubmit(e)} className="stack">
            {!tenantChoices ? (
              <>
                <label htmlFor="login-email">
                  E-mail
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="master@exeq.local ou admin@escritorio.com"
                  />
                  {fieldErrors.email ? (
                    <span className="err" role="alert">
                      {fieldErrors.email}
                    </span>
                  ) : null}
                </label>
                <label htmlFor="login-password">
                  Senha
                  <input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                  />
                  {fieldErrors.password ? (
                    <span className="err" role="alert">
                      {fieldErrors.password}
                    </span>
                  ) : null}
                </label>
                <label htmlFor="login-tenant">
                  Escritório <span className="muted">(opcional)</span>
                  <input
                    id="login-tenant"
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="ex.: escritorio-atibaia — deixe vazio para master ou auto"
                    autoComplete="organization"
                  />
                  <span className="muted small" style={{ display: "block", marginTop: "0.35rem" }}>
                    Operador <strong>EXEQ master</strong> não precisa informar. Um único escritório é detectado
                    automaticamente.
                  </span>
                </label>
              </>
            ) : (
              <fieldset className="login-tenant-picker">
                <legend className="sr-only">Escritórios disponíveis</legend>
                {tenantChoices.map((t) => {
                  const value = t.slug ?? t.automacao_tenant_id;
                  return (
                    <label key={t.automacao_tenant_id} className="login-tenant-option">
                      <input
                        type="radio"
                        name="tenant_pick"
                        value={value}
                        checked={selectedTenant === value}
                        onChange={() => setSelectedTenant(value)}
                      />
                      <span>{tenantLabel(t)}</span>
                    </label>
                  );
                })}
                <button type="button" className="btn-link muted small" onClick={backToCredentials}>
                  ← Voltar e alterar e-mail
                </button>
              </fieldset>
            )}
            {error ? (
              <div className="banner-err" role="alert">
                {error}
              </div>
            ) : null}
            <button type="submit" className="btn-login-cta" disabled={isSubmitting}>
              {isSubmitting ? "Entrando…" : tenantChoices ? "Continuar" : "Entrar"}
            </button>
          </form>
          <div className="login-footer">Autenticação · RLS · sessão auditável</div>
        </div>
      </div>
    </div>
  );
}
