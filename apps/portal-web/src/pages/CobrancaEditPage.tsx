import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cobrancaEditFormSchema } from "../lib/schemas";
import type { CobrancaEditFormValues } from "../lib/schemas";
import { ApiError, fetchPortalCobrancaDetail, patchPortalCobranca } from "../lib/api";
import { chargeStatusLabelPortal, isChargeEditable } from "../lib/charge-status-ui";

export function CobrancaEditPage(): JSX.Element {
  const { chargeId } = useParams<{ chargeId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const detailQ = useQuery({
    queryKey: ["cobranca", chargeId],
    queryFn: () => fetchPortalCobrancaDetail(chargeId!),
    enabled: Boolean(chargeId)
  });

  const charge = detailQ.data?.charge;
  const editable = charge ? isChargeEditable(charge.canonicalStatus) : false;

  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (charge) {
      setAmount(String(charge.amount));
      setDueDate(charge.dueDate);
    }
  }, [charge]);

  const m = useMutation({
    mutationFn: (body: CobrancaEditFormValues) => patchPortalCobranca(chargeId!, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["cobranca", chargeId] });
      await qc.invalidateQueries({ queryKey: ["cobrancas"] });
      navigate(`/cobrancas/${chargeId}`, { replace: true });
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && typeof e.body === "object" && e.body !== null) {
        const code = (e.body as { error?: string }).error;
        if (code === "charge_not_editable") {
          setApiError("Cobrança paga ou cancelada não pode ser alterada.");
          return;
        }
      }
      setApiError(e instanceof Error ? e.message : "Erro ao salvar");
    }
  });

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!chargeId || !editable) {
      return;
    }
    setApiError(null);
    const parsed = cobrancaEditFormSchema.safeParse({
      amount,
      due_date: dueDate
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0];
        if (typeof k === "string" && !fe[k]) {
          fe[k] = issue.message;
        }
      }
      setFieldErrors(fe);
      return;
    }
    setFieldErrors({});
    m.mutate(parsed.data);
  }

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <div>
          <h2 className="shell-page__title">Edição do boleto</h2>
          <p className="shell-page__desc" style={{ marginBottom: 0 }}>
            Atualização via <code style={{ fontSize: "0.85em" }}>PATCH /v1/portal/cobrancas/:id</code> (valor e
            vencimento).
          </p>
        </div>
        {chargeId ? (
          <Link to={`/cobrancas/${chargeId}`} className="btn-secondary">
            Cancelar
          </Link>
        ) : null}
      </div>

      {detailQ.isLoading ? <p className="muted">Carregando…</p> : null}
      {detailQ.isError ? (
        <div className="banner-err">{detailQ.error instanceof Error ? detailQ.error.message : "Erro"}</div>
      ) : null}
      {chargeId && !detailQ.isLoading && !charge ? (
        <div className="banner-err">Boleto não encontrado neste escritório.</div>
      ) : null}

      {charge && !editable ? (
        <div className="banner-err">
          Cobrança com status <strong>{chargeStatusLabelPortal(charge.canonicalStatus)}</strong> não pode ser
          editada.{" "}
          <Link to={`/cobrancas/${chargeId}`} className="link-inline">
            Voltar ao detalhe
          </Link>
        </div>
      ) : null}

      {charge && editable ? (
        <form onSubmit={onSubmit} className="form-grid-proto" style={{ maxWidth: "720px" }}>
          <div className="form-card form-card--full">
            <h3 className="form-card__title">Identificação (somente leitura)</h3>
            <p style={{ margin: "0 0 0.5rem", fontSize: "0.88rem" }}>
              <span className="muted">Referência:</span> <strong>{charge.reference}</strong>
            </p>
            <p style={{ margin: 0, fontSize: "0.88rem" }}>
              <span className="muted">Status:</span> {chargeStatusLabelPortal(charge.canonicalStatus)}
            </p>
          </div>
          <div className="form-card">
            <h3 className="form-card__title">Valores editáveis</h3>
            <label>
              Valor (R$)
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={m.isPending}
              />
              {fieldErrors.amount ? <span className="err">{fieldErrors.amount}</span> : null}
            </label>
            <label>
              Vencimento
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={m.isPending}
              />
              {fieldErrors.due_date ? <span className="err">{fieldErrors.due_date}</span> : null}
            </label>
          </div>
          <div className="form-card">
            <div className="form-actions" style={{ marginTop: 0 }}>
              <Link to={`/cobrancas/${chargeId}`} className="btn-ghost">
                Voltar
              </Link>
              <button type="submit" className="btn-cyan" disabled={m.isPending}>
                {m.isPending ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </div>
          {apiError ? <div className="banner-err form-card--full">{apiError}</div> : null}
        </form>
      ) : null}
    </div>
  );
}
