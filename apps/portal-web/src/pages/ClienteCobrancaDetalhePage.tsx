import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { fetchClientePortalCobrancaDetail } from "../lib/api";

export function ClienteCobrancaDetalhePage(): JSX.Element {
  const { chargeId } = useParams<{ chargeId: string }>();
  const q = useQuery({
    queryKey: ["clientePortalCobranca", chargeId],
    queryFn: () => fetchClientePortalCobrancaDetail(chargeId!),
    enabled: Boolean(chargeId)
  });

  return (
    <div className="shell-page" style={{ maxWidth: 720, margin: "0 auto", padding: "1.5rem" }}>
      <Link to="/cliente/cobrancas" className="btn-secondary">
        Voltar
      </Link>

      {q.isLoading ? <p className="muted">A carregar…</p> : null}
      {q.isError ? <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro"}</div> : null}

      {q.data ? (
        <div className="form-card form-card--full" style={{ marginTop: "1rem" }}>
          <h3>{q.data.description ?? "Cobrança"}</h3>
          <p>
            <strong>Status:</strong> {q.data.canonical_status}
          </p>
          <p>
            <strong>Valor:</strong> {q.data.amount}
          </p>
          <p>
            <strong>Vencimento:</strong> {q.data.due_date}
          </p>
          {q.data.payment?.pix_emv ? (
            <p className="muted small" style={{ wordBreak: "break-all" }}>
              PIX copia e cola: {q.data.payment.pix_emv}
            </p>
          ) : null}
          {q.data.payment?.boleto_url ? (
            <p>
              <a href={q.data.payment.boleto_url} target="_blank" rel="noreferrer" className="link-inline">
                Abrir boleto
              </a>
            </p>
          ) : null}

          <h4 style={{ marginTop: "1.25rem" }}>Histórico</h4>
          <ul className="muted" style={{ paddingLeft: "1.2rem" }}>
            {(q.data.events ?? []).map((ev, i) => (
              <li key={`${ev.created_at}-${i}`}>
                {ev.event_type}: {ev.old_status ?? "—"} → {ev.new_status ?? "—"} ({ev.created_at})
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
