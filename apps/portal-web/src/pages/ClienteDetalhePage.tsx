import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { fetchClienteCobrancas, fetchClientes } from "../lib/api";
import {
  chargeStatusLabelPortal,
  chargeStatusPillClass
} from "../lib/charge-status-ui";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = new Intl.DateTimeFormat("pt-BR");

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return dateFmt.format(d);
}

export function ClienteDetalhePage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const q = useQuery({ queryKey: ["clientes"], queryFn: () => fetchClientes() });
  const cliente = id ? q.data?.data.find((c) => c.id === id) : undefined;

  const cobQ = useQuery({
    queryKey: ["clienteCobrancas", id],
    queryFn: () => fetchClienteCobrancas(id!),
    enabled: Boolean(id)
  });

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <div>
          <h2 className="shell-page__title">Cliente</h2>
          <p className="shell-page__desc" style={{ marginBottom: 0 }}>
            Ficha consolidada e cobranças associadas ao cadastro do escritório.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {id ? (
            <>
              <Link to={`/clientes/${id}/editar`} className="btn-primary">
                Editar
              </Link>
              <Link to={`/cobrancas/nova?clienteId=${encodeURIComponent(id)}`} className="btn-cyan">
                Nova cobrança
              </Link>
            </>
          ) : null}
          <Link to="/clientes" className="btn-secondary">
            Voltar à lista
          </Link>
        </div>
      </div>

      {q.isLoading ? <p className="muted">Carregando…</p> : null}
      {q.isError ? (
        <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro"}</div>
      ) : null}

      {!q.isLoading && q.data && !cliente ? (
        <div className="banner-err">Cliente não encontrado neste escritório.</div>
      ) : null}

      {cliente ? (
        <div className="form-grid-proto" style={{ marginBottom: "1.25rem" }}>
          <div className="form-card">
            <h3 className="form-card__title">Identificação</h3>
            <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>
              <span className="muted">Nome:</span> <strong>{cliente.nome}</strong>
            </p>
            <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>
              <span className="muted">Documento:</span>{" "}
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{cliente.documento}</strong>
            </p>
          </div>
          <div className="form-card">
            <h3 className="form-card__title">Contato</h3>
            <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>
              <span className="muted">E-mail:</span> <strong>{cliente.email ?? "—"}</strong>
            </p>
            <p style={{ margin: "0.25rem 0", fontSize: "0.9rem" }}>
              <span className="muted">WhatsApp opt-in:</span>{" "}
              <strong>{cliente.whatsapp_opt_in ? "Sim" : "Não"}</strong>
            </p>
          </div>
        </div>
      ) : null}

      {cliente ? (
        <div className="form-card" style={{ border: "1px solid var(--exeq-border)", borderRadius: "var(--exeq-radius-md)" }}>
          <h3 className="form-card__title">Cobranças associadas</h3>
          {cobQ.isLoading ? <p className="muted">A carregar…</p> : null}
          {cobQ.isError ? (
            <div className="banner-err">{cobQ.error instanceof Error ? cobQ.error.message : "Erro"}</div>
          ) : null}
          {cobQ.data?.billing_link_status === "missing" && cobQ.data.message ? (
            <div className="banner-warn">{cobQ.data.message}</div>
          ) : null}
          {cobQ.data && !cobQ.isLoading && cobQ.data.billing_link_status !== "missing" ? (
            <div className="table-wrap" style={{ marginTop: "0.5rem" }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Referência</th>
                    <th>Vencimento</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {cobQ.data.data.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="muted">
                        Nenhuma cobrança para este cliente.
                      </td>
                    </tr>
                  ) : (
                    cobQ.data.data.map((row) => (
                      <tr key={row.id}>
                        <td>{row.reference}</td>
                        <td>{formatDate(row.dueDate)}</td>
                        <td>{money.format(Number(row.amount))}</td>
                        <td>
                          <span className={chargeStatusPillClass(row.canonicalStatus)}>
                            {chargeStatusLabelPortal(row.canonicalStatus)}
                          </span>
                        </td>
                        <td>
                          <Link to={`/cobrancas/${row.id}`} state={{ charge: row }} className="link-inline">
                            Ver
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
      ) : null}
    </div>
  );
}
