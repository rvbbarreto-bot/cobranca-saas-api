import { useCallback, useId, useRef, useState } from "react";
import {
  ALLOWED_PEM_EXTENSIONS,
  pemPreviewLines,
  validatePemFileLocal,
  type PemFieldKind,
  type PemValidationFailure
} from "../lib/pem-local-validation";

export type PemUploadZoneStatus = "idle" | "validating" | "success" | "error";

export type PemFileSelection = {
  file: File;
  content: string;
};

type PemFileUploadZoneProps = {
  field: PemFieldKind;
  label: string;
  disabled?: boolean;
  selection: PemFileSelection | null;
  status: PemUploadZoneStatus;
  errorMessage?: string | null;
  onSelect: (selection: PemFileSelection | null, localError: PemValidationFailure | null) => void;
};

function extensionHint(): string {
  return [...ALLOWED_PEM_EXTENSIONS].join(", ");
}

async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Falha ao ler arquivo"));
    reader.readAsText(file);
  });
}

export function PemFileUploadZone({
  field,
  label,
  disabled = false,
  selection,
  status,
  errorMessage,
  onSelect
}: PemFileUploadZoneProps): JSX.Element {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const processFile = useCallback(
    async (file: File) => {
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
      if (!ALLOWED_PEM_EXTENSIONS.has(ext)) {
        onSelect(null, {
          ok: false,
          error_code: "ERR-001",
          message:
            "O arquivo não está no formato PEM. Verifique se contém os delimitadores -----BEGIN...----- / -----END...-----.",
          field
        });
        return;
      }

      const content = await readFileAsText(file);
      const local = validatePemFileLocal(content, file.name, field, file.size);
      if (!local.ok) {
        onSelect(null, local);
        return;
      }
      onSelect({ file, content }, null);
    },
    [field, onSelect]
  );

  const onInputChange = useCallback(
    (ev: React.ChangeEvent<HTMLInputElement>) => {
      const file = ev.target.files?.[0];
      if (!file) {
        return;
      }
      void processFile(file);
      ev.target.value = "";
    },
    [processFile]
  );

  const onDrop = useCallback(
    (ev: React.DragEvent) => {
      ev.preventDefault();
      setDragOver(false);
      if (disabled) {
        return;
      }
      const file = ev.dataTransfer.files[0];
      if (file) {
        void processFile(file);
      }
    },
    [disabled, processFile]
  );

  const preview = selection ? pemPreviewLines(selection.content) : null;

  return (
    <div className="field-label pem-upload-field" style={{ gridColumn: "1 / -1" }}>
      <span>{label}</span>
      <div
        className={[
          "pem-upload-zone",
          dragOver ? "pem-upload-zone--drag" : "",
          status === "success" ? "pem-upload-zone--success" : "",
          status === "error" ? "pem-upload-zone--error" : "",
          status === "validating" ? "pem-upload-zone--loading" : "",
          disabled ? "pem-upload-zone--disabled" : ""
        ]
          .filter(Boolean)
          .join(" ")}
        onDragOver={(ev) => {
          ev.preventDefault();
          if (!disabled) {
            setDragOver(true);
          }
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => {
          if (!disabled) {
            inputRef.current?.click();
          }
        }}
        onKeyDown={(ev) => {
          if ((ev.key === "Enter" || ev.key === " ") && !disabled) {
            ev.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={`${label}: arraste ou clique para selecionar`}
      >
        <input
          id={inputId}
          ref={inputRef}
          type="file"
          accept={[...ALLOWED_PEM_EXTENSIONS].join(",")}
          className="pem-upload-zone__input"
          disabled={disabled}
          onChange={onInputChange}
          tabIndex={-1}
        />
        {status === "validating" ? (
          <p className="pem-upload-zone__status">Validando…</p>
        ) : selection ? (
          <p className="pem-upload-zone__filename">
            {status === "success" ? "✓ " : status === "error" ? "✕ " : ""}
            {selection.file.name}
          </p>
        ) : (
          <p className="pem-upload-zone__hint">
            Arraste o arquivo ou clique para selecionar
            <span className="muted small"> ({extensionHint()})</span>
          </p>
        )}
        {selection && status !== "validating" ? (
          <button
            type="button"
            className="btn-secondary pem-upload-zone__swap"
            disabled={disabled}
            onClick={(ev) => {
              ev.stopPropagation();
              onSelect(null, null);
              inputRef.current?.click();
            }}
          >
            Trocar arquivo
          </button>
        ) : null}
      </div>
      {errorMessage ? <div className="banner-err pem-upload-zone__message">{errorMessage}</div> : null}
      {selection && preview ? (
        <button
          type="button"
          className="btn-link small pem-upload-zone__details-toggle"
          onClick={() => setShowDetails((v) => !v)}
        >
          {showDetails ? "Ocultar detalhes" : "Ver detalhes"}
        </button>
      ) : null}
      {showDetails && preview ? (
        <pre className="pem-upload-zone__preview muted small">
          {preview.header}
          {"\n…\n"}
          {preview.footer}
        </pre>
      ) : null}
    </div>
  );
}
