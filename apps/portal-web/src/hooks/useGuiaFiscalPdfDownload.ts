import { useMutation } from "@tanstack/react-query";
import { fetchGuiaFiscalPdfUrl } from "../lib/api";
import {
  canDownloadGuiaPdf,
  guiaPdfDownloadFilename,
  openGuiaFiscalPdfUrl
} from "../lib/guia-fiscal-download";
import type { GuiaFiscalRow } from "../lib/api";

type UseGuiaFiscalPdfDownloadOptions = {
  guiaId: string;
  guia?: Pick<GuiaFiscalRow, "tipo_guia" | "competencia" | "id" | "status"> | null;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

export function useGuiaFiscalPdfDownload(options: UseGuiaFiscalPdfDownloadOptions) {
  const disabledByStatus = options.guia ? !canDownloadGuiaPdf(options.guia.status) : false;

  const mutation = useMutation({
    mutationFn: () => fetchGuiaFiscalPdfUrl(options.guiaId),
    onSuccess: (data) => {
      const filename = options.guia ? guiaPdfDownloadFilename(options.guia) : undefined;
      openGuiaFiscalPdfUrl(data.pdf_url, filename);
      options.onSuccess?.();
    },
    onError: (err: unknown) => {
      options.onError?.(err instanceof Error ? err.message : "Erro ao obter PDF");
    }
  });

  return {
    download: () => mutation.mutate(),
    isPending: mutation.isPending,
    isDisabled: disabledByStatus || mutation.isPending || !options.guiaId
  };
}
