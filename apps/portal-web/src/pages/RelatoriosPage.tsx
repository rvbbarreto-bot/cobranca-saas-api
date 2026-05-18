import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchCobrancas } from "../lib/api";

function toCsv(rows: { reference: string; dueDate: string; amount: string; canonicalStatus: string }[]): string {
  const header = "referencia;vencimento;valor;status\n";
  const body = rows
    .map((r) =>
      [r.reference, r.dueDate, r.amount, r.canonicalStatus]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(";")
    )
    .join("\n");
  return header + body;
}

export function RelatoriosPage(): JSX.Element {
  const q = useQuery({ queryKey: ["cobrancas"], queryFn: () => fetchCobrancas() });

  function downloadCobrancasCsv(): void {
    if (!q.data?.data.length) {
      return;
    }
    const csv = toCsv(q.data.data);
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobrancas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <h2 className="shell-page__title">Relatórios</h2>
        <Link to="/dashboard" className="btn-secondary">
          Dashboard
        </Link>
      </div>
      <p className="muted">Exportação simples a partir dos dados já carregados do portal (sem novo endpoint).</p>

      {q.isLoading ? <p className="muted">A carregar cobranças…</p> : null}
      {q.isError ? <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro"}</div> : null}

      <div className="form-card form-card--full">
        <h3 className="form-card__title">Cobranças (CSV)</h3>
        <p className="muted small">
          Colunas: referência, vencimento, valor, status. Separador <code>;</code> e UTF-8 com BOM para Excel.
        </p>
        <button
          type="button"
          className="btn-primary"
          disabled={!q.data?.data.length || q.data.billing_link_status === "missing"}
          onClick={() => downloadCobrancasCsv()}
        >
          Descarregar CSV
        </button>
        {q.data?.billing_link_status === "missing" ? (
          <p className="muted small" style={{ marginTop: "0.75rem" }}>
            Sem ligação billing — configure o escritório antes de exportar.
          </p>
        ) : null}
        {!q.isLoading && q.data && q.data.data.length === 0 ? (
          <p className="muted small" style={{ marginTop: "0.75rem" }}>
            Lista vazia — nada para exportar.
          </p>
        ) : null}
      </div>
    </div>
  );
}
