import type { TipoGuia } from "./schemas/guia-fiscal.schema";

const TIPO_GUIA_NOTIFICATION_LABEL: Record<TipoGuia, string> = {
  DAS: "DAS — Simples Nacional",
  DARF: "DARF — Receitas Federais"
};

/** Rótulo legível para WhatsApp/e-mail de guia fiscal disponível. */
export function formatTipoGuiaForNotification(tipo: string): string {
  if (tipo === "DAS" || tipo === "DARF") {
    return TIPO_GUIA_NOTIFICATION_LABEL[tipo];
  }
  return tipo;
}
