import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  hasClienteSession,
  parseJwtPayload,
  postClienteRequestAccess,
  postClienteVerifyToken,
  saveClienteSession
} from "../lib/api";

export function ClienteAcessoPage(): JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tokenFromUrl = searchParams.get("token")?.trim() ?? "";
  const tenantSlug = searchParams.get("tenant")?.trim() ?? "";

  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenFromUrl && tenantSlug));

  useEffect(() => {
    if (hasClienteSession()) {
      navigate("/cliente/cobrancas", { replace: true });
      return;
    }
    if (!tokenFromUrl || !tenantSlug) {
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await postClienteVerifyToken(tokenFromUrl, tenantSlug);
        const claims = parseJwtPayload(res.token);
        if (!claims.tid) {
          throw new Error("Token sem tenant");
        }
        saveClienteSession(res.token, claims.tid);
        if (!cancelled) {
          navigate("/cliente/cobrancas", { replace: true });
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Link inválido ou expirado");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenFromUrl, tenantSlug, navigate]);

  async function onRequestAccess(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!tenantSlug) {
      setError("Informe o tenant na URL (?tenant=slug-do-escritorio)");
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const res = await postClienteRequestAccess(email.trim(), tenantSlug);
      setMessage(res.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Falha ao solicitar acesso");
    } finally {
      setLoading(false);
    }
  }

  if (loading && tokenFromUrl) {
    return (
      <div className="login-page">
        <p className="muted">Validando link de acesso…</p>
      </div>
    );
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1 className="login-card__title">Portal do cliente</h1>
        <p className="login-card__subtitle">Acesse suas cobranças com link por e-mail</p>

        {!tenantSlug ? (
          <p className="banner-err">URL incompleta. Use o link enviado por e-mail ou adicione ?tenant=seu-escritorio</p>
        ) : (
          <form onSubmit={onRequestAccess} className="login-form">
            <label>
              E-mail
              <input
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                required
                autoComplete="email"
                disabled={loading}
              />
            </label>
            <button type="submit" className="btn-primary" disabled={loading || !email.trim()}>
              Enviar link de acesso
            </button>
          </form>
        )}

        {message ? <p className="banner-ok">{message}</p> : null}
        {error ? <p className="banner-err">{error}</p> : null}

        <p className="muted small" style={{ marginTop: "1rem" }}>
          <Link to="/login">Área do escritório</Link>
        </p>
      </div>
    </div>
  );
}

