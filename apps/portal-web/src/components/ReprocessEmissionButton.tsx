import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./ToastProvider";
import { reprocessPortalCobrancaEmission } from "../lib/api";

type Props = {
  chargeId: string;
  className?: string;
};

export function ReprocessEmissionButton({ chargeId, className = "link-inline" }: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const mutation = useMutation({
    mutationFn: () => reprocessPortalCobrancaEmission(chargeId),
    onSuccess: async () => {
      showToast("Emissão reagendada. Acompanhe o status no detalhe.");
      await queryClient.invalidateQueries({ queryKey: ["cobranca", chargeId] });
      await queryClient.invalidateQueries({ queryKey: ["cobrancas"] });
      setOpen(false);
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Não foi possível reprocessar.";
      showToast(msg);
    }
  });

  return (
    <>
      <button
        type="button"
        className={className}
        style={{ background: "none", border: "none", padding: 0, font: "inherit", cursor: mutation.isPending ? "wait" : "pointer" }}
        disabled={mutation.isPending}
        onClick={() => setOpen(true)}
      >
        Reprocessar
      </button>
      <ConfirmDialog
        open={open}
        title="Reprocessar emissão?"
        message="A cobrança voltará para rascunho e a emissão no gateway será tentada novamente em segundo plano."
        confirmLabel={mutation.isPending ? "Reprocessando…" : "Reprocessar"}
        cancelLabel="Cancelar"
        onConfirm={() => mutation.mutate()}
        onCancel={() => {
          if (!mutation.isPending) {
            setOpen(false);
          }
        }}
      />
    </>
  );
}
