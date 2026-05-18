import { FormEvent, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { loginFormSchema } from "../lib/schemas";

export function LoginPage(): JSX.Element {
  const qc = useQueryClient();
  const { isAuthenticated, login, error, isSubmitting, clearError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    clearError();
    const parsed = loginFormSchema.safeParse({ email, tenant_id: tenantId, password });
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
    try {
      await login(parsed.data);
      await qc.invalidateQueries();
      navigate("/dashboard", { replace: true });
    } catch {
      /* error no contexto */
    }
  }

  return (
    <div className="login-layout">
      <div className="login-brand">
        <h1 className="login-brand__logo">EXEQ</h1>
        <p className="login-brand__tag">Cobrança & Boletos</p>
        <p className="login-brand__lead">
          Portal de cobrança recorrente com autenticação segura, trilha de auditoria e integração bancária.
        </p>
        <p className="login-brand__sub">
          Substituição da planilha por um ambiente transacional com cadastro, boletos, notificações e governança
          operacional.
        </p>
      </div>
      <div className="login-panel">
        <div className="login-card">
          <h2 className="login-card__title">Entrar</h2>
          <p className="login-card__subtitle">Acesso restrito por e-mail e senha</p>
          <form onSubmit={(e) => void onSubmit(e)} className="stack">
            <label htmlFor="login-email">
              E-mail corporativo
              <input
                id="login-email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubmitting}
                placeholder="nome@empresa.com.br"
              />
              {fieldErrors.email ? <span className="err">{fieldErrors.email}</span> : null}
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
              {fieldErrors.password ? <span className="err">{fieldErrors.password}</span> : null}
            </label>
            <label htmlFor="login-tenant">
              Tenant / Escritório
              <input
                id="login-tenant"
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                disabled={isSubmitting}
                placeholder='UUID ou slug, ex.: "escritorio-demo"'
              />
              {fieldErrors.tenant_id ? <span className="err">{fieldErrors.tenant_id}</span> : null}
            </label>
            {error ? <div className="banner-err">{error}</div> : null}
            <button type="submit" className="btn-login-cta" disabled={isSubmitting}>
              {isSubmitting ? "Entrando…" : "Entrar no portal"}
            </button>
          </form>
          <div className="login-footer">
            Autenticação · RLS · sessão auditável
            <a href="#recuperar" onClick={(e) => e.preventDefault()}>
              Esqueci minha senha
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
