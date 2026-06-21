import { useCallback, useEffect, useState } from "react";
import { PemFileUploadZone, type PemFileSelection, type PemUploadZoneStatus } from "./PemFileUploadZone";
import type { PemValidationFailure } from "../lib/pem-local-validation";

export type FiscalA1PemState = {
  ready: boolean;
  certificadoPem: string;
  chavePrivadaPem: string;
};

type FiscalA1PemPairProps = {
  disabled?: boolean;
  /** Incrementar após gravação bem-sucedida para limpar os arquivos PEM. */
  resetKey?: number;
  onStateChange: (state: FiscalA1PemState) => void;
};

type SideState = {
  selection: PemFileSelection | null;
  status: PemUploadZoneStatus;
  error: string | null;
};

const INITIAL: SideState = { selection: null, status: "idle", error: null };

/** Upload PEM fiscal A1 — reutiliza zonas drag-drop (sem validação gateway Inter). */
export function FiscalA1PemPair({
  disabled = false,
  resetKey = 0,
  onStateChange
}: FiscalA1PemPairProps): JSX.Element {
  const [cert, setCert] = useState<SideState>(INITIAL);
  const [key, setKey] = useState<SideState>(INITIAL);

  const emit = useCallback(
    (c: SideState, k: SideState) => {
      const ready = Boolean(c.selection?.content && k.selection?.content);
      onStateChange({
        ready,
        certificadoPem: c.selection?.content ?? "",
        chavePrivadaPem: k.selection?.content ?? ""
      });
    },
    [onStateChange]
  );

  const handleCert = useCallback(
    (selection: PemFileSelection | null, localError: PemValidationFailure | null) => {
      const next: SideState = localError
        ? { selection: null, status: "error", error: localError.message }
        : selection
          ? { selection, status: "success", error: null }
          : INITIAL;
      setCert(next);
      emit(next, key);
    },
    [emit, key]
  );

  const handleKey = useCallback(
    (selection: PemFileSelection | null, localError: PemValidationFailure | null) => {
      const next: SideState = localError
        ? { selection: null, status: "error", error: localError.message }
        : selection
          ? { selection, status: "success", error: null }
          : INITIAL;
      setKey(next);
      emit(cert, next);
    },
    [cert, emit]
  );

  useEffect(() => {
    emit(cert, key);
  }, [cert, key, emit]);

  useEffect(() => {
    setCert(INITIAL);
    setKey(INITIAL);
    onStateChange({ ready: false, certificadoPem: "", chavePrivadaPem: "" });
  }, [resetKey, onStateChange]);

  return (
    <div className="pem-pair-uploader" data-testid="fiscal-a1-pem-pair" style={{ display: "contents" }}>
      <PemFileUploadZone
        field="certificate"
        label="Certificado digital (.crt / .pem / .cer)"
        disabled={disabled}
        selection={cert.selection}
        status={cert.status}
        errorMessage={cert.error}
        onSelect={handleCert}
      />
      <PemFileUploadZone
        field="private_key"
        label="Chave privada (.key / .pem)"
        disabled={disabled}
        selection={key.selection}
        status={key.status}
        errorMessage={key.error}
        onSelect={handleKey}
      />
    </div>
  );
}
