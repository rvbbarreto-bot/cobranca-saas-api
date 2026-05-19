import { useState } from "react";
import { Link } from "react-router-dom";
import { downloadEscritorioCobrancasCsv } from "../lib/api";

export function RelatoriosPage(): JSX.Element {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDownload(): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      const blob = await downloadEscritorioCobrancasCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cobrancas-escritorio-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha no export");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <h2 className="shell-page__title">Relatórios</h2>
        <Link to="/dashboard" className="btn-secondary">
          Dashboard
        </Link>
      </div>
      <p className="muted">
        Exportação oficial do escritório via <code>GET /v1/portal/escritorio/cobrancas/export</code> (dados mascarados).
      </p>

      {error ? <div className="banner-err">{error}</div> : null}

      <div className="form-card form-card--full">
        <h3 className="form-card__title">Cobranças (CSV)</h3>
        <p className="muted small">Formato servidor: separador vírgula, documentos mascarados, datas pt-BR.</p>
        <button type="button" className="btn-primary" disabled={loading} onClick={() => void onDownload()}>
          {loading ? "A gerar…" : "Descarregar CSV do servidor"}
        </button>
      </div>
    </div>
  );
}
