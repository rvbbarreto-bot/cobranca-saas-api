import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CsvFileUploadZone } from "../components/CsvFileUploadZone";
import { ShellPageHeader } from "../components/ShellPageHeader";
import { useFiscalIngestPolling } from "../hooks/useFiscalIngestPolling";
import { ApiError, postFiscalIngestCsv, postProcessamentosFromIngest } from "../lib/api";
import {
  canStartTransmissionFromIngest,
  fiscalIngestStatusLabel,
  fiscalIngestStatusPillClass,
  PGDASD_CSV_REQUIRED_COLUMNS
} from "../lib/fiscal-ingest-ui";
import { isFiscalGuiasNavEnabled } from "../lib/fiscal-feature";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function ImportPgdasdPage(): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fiscalEnabled = isFiscalGuiasNavEnabled();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [ingestId, setIngestId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { ingest, isPolling } = useFiscalIngestPolling(ingestId);

  const upload = useMutation({
    mutationFn: (file: File) => postFiscalIngestCsv(file),
    onSuccess: (data) => {
      setUploadError(null);
      setIngestId(data.ingest.id);
    },
    onError: (err: unknown) => {
      setIngestId(null);
      setUploadError(err instanceof ApiError ? err.message : "Falha ao enviar CSV.");
    }
  });

  const startTransmission = useMutation({
    mutationFn: (id: string) => postProcessamentosFromIngest(id),
    onSuccess: (data) => {
      const firstId = data.processamentos[0]?.id;
      if (firstId) {
        navigate(`/processamentos-fiscais/${firstId}`);
      } else {
        navigate("/processamentos-fiscais");
      }
    },
    onError: (err: unknown) => {
      setUploadError(err instanceof ApiError ? err.message : "Falha ao iniciar transmissão.");
    }
  });

  if (!fiscalEnabled) {
    return (
      <div className="shell-page">
        <ShellPageHeader title="Importar PGDASD (CSV)" description="Módulo fiscal desligado neste ambiente." />
      </div>
    );
  }

  function handleUpload(): void {
    if (!selectedFile) return;
    setUploadError(null);
    upload.mutate(selectedFile);
  }

  function handleReset(): void {
    setSelectedFile(null);
    setLocalError(null);
    setIngestId(null);
    setUploadError(null);
    upload.reset();
    startTransmission.reset();
    void queryClient.removeQueries({ queryKey: ["fiscalIngest"] });
  }

  const displayIngest = ingest;
  const showResults = Boolean(displayIngest && !isPolling && upload.isSuccess);

  return (
    <div className="shell-page">
      <ShellPageHeader
        title="Importar PGDASD (CSV)"
        description="Envie o layout v1, aguarde a validação e inicie a transmissão SERPRO quando estiver OK."
        actions={
          <Link to="/processamentos-fiscais" className="btn-secondary">
            Ver processamentos
          </Link>
        }
      />

      <div className="form-card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Colunas obrigatórias</h3>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          {PGDASD_CSV_REQUIRED_COLUMNS.join(", ")}
        </p>
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Spec completa: <code>docs/templates/PGDASD_CSV_SPEC.md</code> no repositório da API.
        </p>
      </div>

      {!ingestId ? (
        <div className="form-card" style={{ marginTop: "1rem" }}>
          <CsvFileUploadZone
            file={selectedFile}
            disabled={upload.isPending}
            uploading={upload.isPending}
            errorMessage={localError ?? uploadError}
            onSelect={(file, err) => {
              setSelectedFile(file);
              setLocalError(err);
              if (err) setUploadError(null);
            }}
          />
          <div style={{ marginTop: "1rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-primary"
              disabled={!selectedFile || Boolean(localError) || upload.isPending}
              onClick={handleUpload}
            >
              {upload.isPending ? "Enviando…" : "Enviar e validar"}
            </button>
          </div>
        </div>
      ) : null}

      {ingestId && (isPolling || showResults) ? (
        <div className="form-card" style={{ marginTop: "1rem" }} data-testid="fiscal-ingest-result">
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
            <span
              className={`status-pill ${fiscalIngestStatusPillClass(displayIngest?.status ?? "VALIDANDO")}`}
            >
              {fiscalIngestStatusLabel(displayIngest?.status ?? "VALIDANDO")}
            </span>
            {displayIngest?.original_filename ? (
              <span className="muted">{displayIngest.original_filename}</span>
            ) : null}
            {isPolling ? <span className="muted">Atualizando a cada 3s…</span> : null}
          </div>

          {showResults && displayIngest ? (
            <>
              <p style={{ marginTop: "1rem" }}>
                {displayIngest.valid_count} linha(s) válida(s) · {displayIngest.error_count} erro(s) ·{" "}
                {displayIngest.row_count} total
              </p>

              {displayIngest.status === "ERRO" && displayIngest.validation_errors.length > 0 ? (
                <div className="table-wrap" style={{ marginTop: "1rem" }}>
                  <table className="data-table" data-testid="fiscal-ingest-errors">
                    <thead>
                      <tr>
                        <th>Linha</th>
                        <th>Campo</th>
                        <th>Código</th>
                        <th>Mensagem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayIngest.validation_errors.map((err, idx) => (
                        <tr key={`${err.linha}-${err.campo}-${idx}`}>
                          <td>{err.linha}</td>
                          <td>{err.campo}</td>
                          <td>{err.codigo}</td>
                          <td>{err.mensagem}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="muted" style={{ marginTop: "0.75rem" }}>
                    Corrija o CSV e use &quot;Enviar outro arquivo&quot; para reenviar.
                  </p>
                </div>
              ) : null}

              {displayIngest.status === "VALIDADO" && displayIngest.canonical_rows.length > 0 ? (
                <div className="table-wrap" style={{ marginTop: "1rem" }}>
                  <table className="data-table" data-testid="fiscal-ingest-preview">
                    <thead>
                      <tr>
                        <th>CNPJ</th>
                        <th>Competência</th>
                        <th>Receita</th>
                        <th>DAS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayIngest.canonical_rows.map((row) => (
                        <tr key={`${row.cnpj}-${row.competencia}`}>
                          <td>{row.cnpj}</td>
                          <td>{row.competencia}</td>
                          <td>{money.format(row.receita_bruta_mes)}</td>
                          <td>{money.format(row.valor_total_das)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}

              <div style={{ marginTop: "1.25rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button type="button" className="btn-secondary" onClick={handleReset}>
                  Enviar outro arquivo
                </button>
                {canStartTransmissionFromIngest(displayIngest.status) ? (
                  <button
                    type="button"
                    className="btn-primary"
                    data-testid="fiscal-start-transmission"
                    disabled={startTransmission.isPending}
                    onClick={() => startTransmission.mutate(displayIngest.id)}
                  >
                    {startTransmission.isPending ? "Iniciando…" : "Iniciar transmissão"}
                  </button>
                ) : null}
              </div>
              {uploadError ? (
                <p className="form-error" role="alert" style={{ marginTop: "0.75rem" }}>
                  {uploadError}
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
