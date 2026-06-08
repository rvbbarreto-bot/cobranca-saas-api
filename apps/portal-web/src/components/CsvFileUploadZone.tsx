import { useCallback, useId, useRef, useState } from "react";
import { isCsvFile, PGDASD_CSV_MAX_BYTES } from "../lib/fiscal-ingest-ui";

type CsvFileUploadZoneProps = {
  disabled?: boolean;
  file: File | null;
  uploading?: boolean;
  errorMessage?: string | null;
  onSelect: (file: File | null, localError: string | null) => void;
};

export function CsvFileUploadZone(props: CsvFileUploadZoneProps): JSX.Element {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const validateFile = useCallback((candidate: File): string | null => {
    if (!isCsvFile(candidate)) {
      return "Selecione um arquivo .csv (PGDASD v1).";
    }
    if (candidate.size > PGDASD_CSV_MAX_BYTES) {
      return "Arquivo excede 2 MB.";
    }
    if (candidate.size === 0) {
      return "Arquivo vazio.";
    }
    return null;
  }, []);

  const handleFile = useCallback(
    (candidate: File | null) => {
      if (!candidate) {
        props.onSelect(null, null);
        return;
      }
      const err = validateFile(candidate);
      props.onSelect(err ? null : candidate, err);
    },
    [props, validateFile]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      if (props.disabled || props.uploading) return;
      const dropped = event.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile, props.disabled, props.uploading]
  );

  return (
    <div
      className={`pem-upload-zone${dragOver ? " pem-upload-zone--drag" : ""}`}
      data-testid="csv-upload-zone"
      onDragOver={(e) => {
        e.preventDefault();
        if (!props.disabled && !props.uploading) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      onClick={() => {
        if (!props.disabled && !props.uploading) inputRef.current?.click();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!props.disabled && !props.uploading) inputRef.current?.click();
        }
      }}
      role="button"
      tabIndex={props.disabled || props.uploading ? -1 : 0}
      aria-disabled={props.disabled || props.uploading}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        hidden
        disabled={props.disabled || props.uploading}
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {props.uploading ? (
        <p>Enviando e validando…</p>
      ) : props.file ? (
        <>
          <p>
            <strong>{props.file.name}</strong>
          </p>
          <p className="muted">{(props.file.size / 1024).toFixed(1)} KB — clique para trocar</p>
        </>
      ) : (
        <>
          <p>
            <strong>Arraste o CSV PGDASD</strong> ou clique para selecionar
          </p>
          <p className="muted">UTF-8, separador vírgula, máx. 2 MB</p>
        </>
      )}
      {props.errorMessage ? (
        <p className="form-error" role="alert" style={{ marginTop: "0.75rem" }}>
          {props.errorMessage}
        </p>
      ) : null}
    </div>
  );
}
