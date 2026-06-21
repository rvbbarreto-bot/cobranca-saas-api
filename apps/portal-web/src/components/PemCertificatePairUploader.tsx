import { useCallback, useEffect, useState } from "react";
import { PemFileUploadZone, type PemFileSelection, type PemUploadZoneStatus } from "./PemFileUploadZone";
import { validateCertificateUpload, type CertificateValidateResponse } from "../lib/api";
import type { PemValidationFailure } from "../lib/pem-local-validation";

export type PemPairValidationState = {
  ready: boolean;
  certificateUploadId: string | null;
  integrationIdOu: string | null;
  warnings: string[];
  info: string[];
};

type PemCertificatePairUploaderProps = {
  disabled?: boolean;
  onStateChange: (state: PemPairValidationState) => void;
};

type SideState = {
  selection: PemFileSelection | null;
  status: PemUploadZoneStatus;
  error: string | null;
};

const INITIAL_SIDE: SideState = { selection: null, status: "idle", error: null };

export function PemCertificatePairUploader({
  disabled = false,
  onStateChange
}: PemCertificatePairUploaderProps): JSX.Element {
  const [cert, setCert] = useState<SideState>(INITIAL_SIDE);
  const [key, setKey] = useState<SideState>(INITIAL_SIDE);
  const [pairStatus, setPairStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pairError, setPairError] = useState<string | null>(null);
  const [result, setResult] = useState<CertificateValidateResponse | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const emitNotReady = useCallback(() => {
    onStateChange({
      ready: false,
      certificateUploadId: null,
      integrationIdOu: null,
      warnings: [],
      info: []
    });
  }, [onStateChange]);

  const handleCertSelect = useCallback(
    (selection: PemFileSelection | null, localError: PemValidationFailure | null) => {
      setResult(null);
      setPairStatus("idle");
      setPairError(null);
      if (localError) {
        setCert({ selection: null, status: "error", error: localError.message });
        emitNotReady();
        return;
      }
      if (!selection) {
        setCert(INITIAL_SIDE);
        emitNotReady();
        return;
      }
      setCert({ selection, status: "success", error: null });
    },
    [emitNotReady]
  );

  const handleKeySelect = useCallback(
    (selection: PemFileSelection | null, localError: PemValidationFailure | null) => {
      setResult(null);
      setPairStatus("idle");
      setPairError(null);
      if (localError) {
        setKey({ selection: null, status: "error", error: localError.message });
        emitNotReady();
        return;
      }
      if (!selection) {
        setKey(INITIAL_SIDE);
        emitNotReady();
        return;
      }
      setKey({ selection, status: "success", error: null });
    },
    [emitNotReady]
  );

  useEffect(() => {
    if (!cert.selection || !key.selection || disabled) {
      return;
    }

    let cancelled = false;
    setPairStatus("loading");
    setCert((s) => ({ ...s, status: "validating" }));
    setKey((s) => ({ ...s, status: "validating" }));
    setPairError(null);

    void validateCertificateUpload(cert.selection.file, key.selection.file)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setResult(response);
        setPairStatus("success");
        setCert((s) => ({ ...s, status: "success", error: null }));
        setKey((s) => ({ ...s, status: "success", error: null }));
        onStateChange({
          ready: true,
          certificateUploadId: response.certificate_id,
          integrationIdOu: response.integration_id_ou ?? null,
          warnings: response.warnings ?? [],
          info: response.info ?? []
        });
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : "Não foi possível validar o certificado. Verifique sua conexão e tente novamente.";
        setPairStatus("error");
        setPairError(message);
        setCert((s) => ({ ...s, status: "error" }));
        setKey((s) => ({ ...s, status: "error" }));
        emitNotReady();
      });

    return () => {
      cancelled = true;
    };
  }, [cert.selection, key.selection, disabled, retryToken, onStateChange, emitNotReady]);

  return (
    <div className="pem-pair-uploader" style={{ gridColumn: "1 / -1", display: "contents" }}>
      <PemFileUploadZone
        field="certificate"
        label="Certificado digital (.crt / .pem / .cer)"
        disabled={disabled || pairStatus === "loading"}
        selection={cert.selection}
        status={cert.status}
        errorMessage={cert.error}
        onSelect={handleCertSelect}
      />
      <PemFileUploadZone
        field="private_key"
        label="Chave privada (.key / .pem)"
        disabled={disabled || pairStatus === "loading"}
        selection={key.selection}
        status={key.status}
        errorMessage={key.error}
        onSelect={handleKeySelect}
      />
      {pairStatus === "loading" ? (
        <p className="muted small" style={{ gridColumn: "1 / -1" }}>
          Validando par certificado/chave no servidor…
        </p>
      ) : null}
      {pairError ? (
        <div className="banner-err" style={{ gridColumn: "1 / -1" }}>
          {pairError}
          <button
            type="button"
            className="btn-secondary"
            style={{ marginLeft: "0.75rem" }}
            onClick={() => setRetryToken((t) => t + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : null}
      {result?.integration_id_ou ? (
        <div className="banner-ok" style={{ gridColumn: "1 / -1" }}>
          <strong>Client ID esperado (OU do certificado Inter):</strong>{" "}
          <code>{result.integration_id_ou}</code>
          <p className="muted small" style={{ margin: "0.35rem 0 0" }}>
            O Client ID no formulário deve ser exatamente este UUID (Portal Developers Inter).
          </p>
        </div>
      ) : null}
      {result?.info?.length ? (
        <div className="banner-ok" style={{ gridColumn: "1 / -1" }}>
          {result.info.map((line) => (
            <p key={line} style={{ margin: "0.25rem 0" }}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
      {result?.warnings?.includes("WARN-001") ? (
        <div className="banner-warn" style={{ gridColumn: "1 / -1" }}>
          O certificado expira em breve. Planeje a renovação.
        </div>
      ) : null}
    </div>
  );
}
