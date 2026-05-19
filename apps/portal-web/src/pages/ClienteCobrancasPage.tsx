import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { clearClienteSession, fetchClientePortalCobrancas } from "../lib/api";

function fmtMoney(v: string): string {
  const n = Number(v);
  if (Number.isNaN(n)) return v;
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ClienteCobrancasPage(): JSX.Element {
  const q = useQuery({
    queryKey: ["clientePortalCobrancas"],
    queryFn: () => fetchClientePortalCobrancas()
  });

  function logout(): void {
    clearClienteSession();
    window.location.href = "/acesso";
  }

  return (
    <div className="shell-page" style={{ maxWidth: 960, margin: "0 auto", padding: "1.5rem" }}>
      <div
        className="shell-page__head"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <div>
          <h2 className="shell-page__title">Minhas cobranças</h2>
          <p className="muted">Portal do cliente — apenas suas cobranças</p>
        </div>
        <button type="button" className="btn-secondary" onClick={logout}>
          Sair
        </button>
      </div>

      {q.isLoading ? <p className="muted">A carregar…</p> : null}
      {q.isError ? (
        <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro"}</div>
      ) : null}

      {q.data ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Referência</th>
                <th>Vencimento</th>
                <th>Valor</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {q.data.data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    Nenhuma cobrança encontrada.
                  </td>
                </tr>
              ) : (
                q.data.data.map((c) => (
                  <tr key={c.id}>
                    <td>{c.description ?? c.id.slice(0, 8)}</td>
                    <td>{c.due_date}</td>
                    <td>{fmtMoney(c.amount)}</td>
                    <td>{c.canonical_status}</td>
                    <td>
                      <Link to={`/cliente/cobrancas/${c.id}`} className="link-inline">
                        Detalhe
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
