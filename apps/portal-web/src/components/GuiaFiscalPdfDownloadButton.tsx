import { useGuiaFiscalPdfDownload } from "../hooks/useGuiaFiscalPdfDownload";
import { guiaPdfDownloadLabel } from "../lib/guia-fiscal-download";
import type { GuiaFiscalRow } from "../lib/api";

type GuiaFiscalPdfDownloadButtonProps = {
  guiaId: string;
  guia?: Pick<GuiaFiscalRow, "tipo_guia" | "competencia" | "id" | "status"> | null;
  label?: string;
  variant?: "primary" | "secondary";
  fullWidth?: boolean;
  className?: string;
  onError?: (message: string) => void;
};

export function GuiaFiscalPdfDownloadButton(props: GuiaFiscalPdfDownloadButtonProps): JSX.Element {
  const { download, isPending, isDisabled } = useGuiaFiscalPdfDownload({
    guiaId: props.guiaId,
    guia: props.guia,
    onError: props.onError
  });

  const label =
    props.label ??
    (props.guia ? guiaPdfDownloadLabel(props.guia) : "Baixar PDF");

  const btnClass = [
    props.variant === "secondary" ? "btn-secondary" : "btn-primary",
    "guia-pdf-download-btn",
    props.fullWidth ? "guia-pdf-download-btn--full" : "",
    props.className ?? ""
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={btnClass}
      disabled={isDisabled}
      onClick={() => download()}
      data-testid="guia-pdf-download"
      aria-label={label}
    >
      {isPending ? "A preparar PDF…" : label}
    </button>
  );
}
