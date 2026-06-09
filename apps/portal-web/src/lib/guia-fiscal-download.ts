import type { GuiaFiscalRow } from "./api";

export function canDownloadGuiaPdf(status: string | undefined): boolean {
  if (!status) return false;
  return status !== "PROCESSANDO" && status !== "CANCELADO";
}

export function guiaPdfDownloadFilename(guia: Pick<GuiaFiscalRow, "tipo_guia" | "competencia" | "id">): string {
  const competencia = guia.competencia.replace(/[^\d-]/g, "") || "competencia";
  return `${guia.tipo_guia}-${competencia}.pdf`;
}

export function guiaPdfDownloadLabel(guia: Pick<GuiaFiscalRow, "tipo_guia">): string {
  return guia.tipo_guia === "DAS" ? "Baixar DAS (PDF)" : "Baixar PDF da guia";
}

/** Abre documento externo — anchor click funciona melhor que window.open em mobile. */
export function openGuiaFiscalPdfUrl(pdfUrl: string, filename?: string): void {
  const anchor = document.createElement("a");
  anchor.href = pdfUrl;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  if (filename) {
    anchor.download = filename;
  }
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export function resolveProcessamentoIdForGuia(input: {
  stateProcessamentoId?: string | null;
  queryProcessamentoId?: string | null;
  processamentoFromList?: { id: string } | null;
}): string | null {
  return input.stateProcessamentoId?.trim() || input.queryProcessamentoId?.trim() || input.processamentoFromList?.id || null;
}
