import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./ToastProvider";
import { PortalValidationError, reprocessPortalCobrancaEmission } from "../lib/api";

type Props = {
  chargeId: string;
  className?: string;
  /** Texto do botão (default "Reprocessar"). */
  label?: string;
  /** Texto enquanto a mutação roda (default "Reprocessando…"). */
  pendingLabel?: string;
  confirmTitle?: string;
  confirmMessage?: string;
  /** Desabilita o botão por uma condição externa (ex.: polling ativo). */
  disabled?: boolean;
  /** Chamado após a API aceitar o reprocesso (ex.: reiniciar o polling). */
  onReprocessed?: () => void;
};

export function ReprocessEmissionButton({
  chargeId,
  className = "link-inline",
  label = "Reprocessar",
  pendingLabel = "Reprocessando…",
  confirmTitle = "Reprocessar emissão?",
  confirmMessage = "A cobrança voltará para rascunho e a emissão no gateway será tentada novamente em segundo plano.",
  disabled = false,
  onReprocessed
}: Props): JSX.Element {
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
      onReprocessed?.();
    },
    onError: (err: unknown) => {
      if (err instanceof PortalValidationError && err.issues.length > 0) {
        showToast(err.issues.map((i) => i.message).join(" "));
        return;
      }
      const msg = err instanceof Error ? err.message : "Não foi possível reprocessar.";
      showToast(msg);
    }
  });

  const isDisabled = disabled || mutation.isPending;

  return (
    <>
      <button
        type="button"
        className={className}
        style={isDisabled ? { cursor: "wait" } : undefined}
        disabled={isDisabled}
        onClick={() => setOpen(true)}
      >
        {mutation.isPending ? pendingLabel : label}
      </button>
      <ConfirmDialog
        open={open}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={mutation.isPending ? pendingLabel : label}
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
