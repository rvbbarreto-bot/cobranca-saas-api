import { useMutation } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { GuiaFiscalPdfDownloadButton } from "../components/GuiaFiscalPdfDownloadButton";
import { ProcessamentoStepper } from "../components/ProcessamentoStepper";
import { ShellPageHeader } from "../components/ShellPageHeader";
import { useProcessamentoPolling } from "../hooks/useProcessamentoPolling";
import { fetchProcessamentoReciboUrl } from "../lib/api";
import { openGuiaFiscalPdfUrl } from "../lib/guia-fiscal-download";
import {
  formatProcessamentoEventoLabel,
  processamentoErroHelp,
  processamentoLiveUserMessage,
  processamentoStatusLabel,
  processamentoStatusPillClass
} from "../lib/processamento-fiscal-ui";

export function ProcessamentoDetalhePage(): JSX.Element {
  const { processamentoId = "" } = useParams();
  const { processamento: proc, eventos, isPolling, query } = useProcessamentoPolling(
    processamentoId || undefined
  );

  const downloadRecibo = useMutation({
    mutationFn: () => fetchProcessamentoReciboUrl(processamentoId),
    onSuccess: (data) => {
      openGuiaFiscalPdfUrl(data.pdf_url, `recibo-${processamentoId}.pdf`);
    }
  });

  const erroHelp = proc?.erro_codigo ? processamentoErroHelp(proc.erro_codigo) : null;

  return (
    <div className="shell-page">
      <ShellPageHeader
        title="Acompanhamento da transmissão"
        below={
          <Link to="/processamentos-fiscais" className="link-inline">
            ← Processamentos PGDASD
          </Link>
        }
      />

      {query.isLoading ? <p className="muted">A carregar…</p> : null}
      {query.isError ? (
        <p className="form-error" role="alert">
          {query.error instanceof Error ? query.error.message : "Erro ao carregar processamento."}
        </p>
      ) : null}

      {proc ? (
        <>
          <div className="form-card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
              <span className={`status-pill ${processamentoStatusPillClass(proc.status)}`}>
                {processamentoStatusLabel(proc.status)}
              </span>
              <span className="muted">Competência {proc.competencia}</span>
              {proc.protocolo_serpro ? (
                <span className="muted">Protocolo {proc.protocolo_serpro}</span>
              ) : null}
            </div>

            <div
              className={`fiscal-live-banner${isPolling ? " fiscal-live-banner--polling" : ""}`}
              data-testid="fiscal-live-message"
              role="status"
            >
              {processamentoLiveUserMessage(proc.status)}
              {isPolling ? " Atualizando automaticamente a cada 3 segundos." : null}
            </div>

            {erroHelp ? (
              <div className="form-card" style={{ marginTop: "1rem", background: "#fef2f2" }}>
                <strong>{erroHelp.titulo}</strong>
                <p className="muted" style={{ margin: "0.35rem 0 0" }}>
                  {erroHelp.sugestao}
                </p>
                {proc.erro_codigo ? (
                  <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
                    Código técnico: {proc.erro_codigo}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="form-card" style={{ marginBottom: "1rem" }}>
            <h3 style={{ marginTop: 0 }}>Etapas</h3>
            <ProcessamentoStepper
              status={proc.status}
              protocolo_serpro={proc.protocolo_serpro}
              recibo_disponivel={proc.recibo_disponivel}
              guia_fiscal_id={proc.guia_fiscal_id}
            />
          </div>

          {proc.guia_fiscal_id || proc.recibo_disponivel ? (
            <div className="form-card guia-das-panel" data-testid="processamento-documentos">
              <h3 style={{ marginTop: 0 }}>Documentos</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                Recibo de transmissão e guia DAS gerada após conclusão do pipeline SERPRO.
              </p>
              <div className="guia-detail-actions">
                {proc.recibo_disponivel ? (
                  <button
                    type="button"
                    className="btn-secondary guia-pdf-download-btn guia-pdf-download-btn--full"
                    disabled={downloadRecibo.isPending}
                    onClick={() => downloadRecibo.mutate()}
                  >
                    {downloadRecibo.isPending ? "A preparar recibo…" : "Baixar recibo"}
                  </button>
                ) : null}
                {proc.guia_fiscal_id ? (
                  <>
                    <Link
                      to={`/guias-fiscais/${proc.guia_fiscal_id}`}
                      state={{ processamentoId }}
                      className="btn-secondary guia-pdf-download-btn guia-pdf-download-btn--full"
                      data-testid="processamento-ver-guia"
                    >
                      Ver guia DAS
                    </Link>
                    <GuiaFiscalPdfDownloadButton
                      guiaId={proc.guia_fiscal_id}
                      guia={{ id: proc.guia_fiscal_id, tipo_guia: "DAS", competencia: proc.competencia, status: "DISPONIVEL" }}
                      fullWidth
                    />
                  </>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="form-card">
            <h3 style={{ marginTop: 0 }}>Histórico</h3>
            <ul style={{ margin: 0, paddingLeft: "1.25rem" }}>
              {eventos.map((ev) => (
                <li key={ev.id} style={{ marginBottom: "0.35rem" }}>
                  <strong>{formatProcessamentoEventoLabel(ev.evento)}</strong>{" "}
                  <span className="muted">{new Date(ev.created_at).toLocaleString("pt-BR")}</span>
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </div>
  );
}
