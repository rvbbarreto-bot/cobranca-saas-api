import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cobrancaFormSchema } from "../lib/schemas";
import { fetchClientes, postPortalCobranca } from "../lib/api";

function newIdempotencyKey(): string {
  const r =
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `portal-${Date.now()}-${r}`.slice(0, 128);
}

export function CobrancaFormPage(): JSX.Element {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const preClienteId = searchParams.get("clienteId")?.trim() || "";

  const clientesQ = useQuery({ queryKey: ["clientes"], queryFn: () => fetchClientes() });
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [portalClienteId, setPortalClienteId] = useState(preClienteId);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const defaultDue = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const m = useMutation({
    mutationFn: (body: Parameters<typeof postPortalCobranca>[0]) => postPortalCobranca(body),
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["cobrancas"] });
      await qc.invalidateQueries({ queryKey: ["clienteCobrancas"] });
      const id = data.charge.id;
      navigate(id ? `/cobrancas/${encodeURIComponent(id)}` : "/cobrancas", { replace: true });
    },
    onError: (e: unknown) => {
      setApiError(e instanceof Error ? e.message : "Erro ao criar cobrança");
    }
  });

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    setApiError(null);
    const parsed = cobrancaFormSchema.safeParse({
      reference,
      amount,
      due_date: dueDate || defaultDue,
      portal_cliente_id: portalClienteId || undefined
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
    const v = parsed.data;
    m.mutate({
      reference: v.reference,
      idempotency_key: newIdempotencyKey(),
      amount: v.amount,
      due_date: v.due_date,
      ...(v.portal_cliente_id ? { portal_cliente_id: v.portal_cliente_id } : {})
    });
  }

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <h2 className="shell-page__title">Nova cobrança</h2>
        <Link to="/cobrancas" className="btn-secondary">
          Voltar
        </Link>
      </div>
      <p className="muted">
        A cobrança é criada em rascunho e a emissão no gateway (Asaas) ocorre em segundo plano. Após salvar, você verá o
        QR Code PIX ou o link do boleto na tela de detalhe.
      </p>

      <form onSubmit={(e) => void onSubmit(e)} className="form-grid">
        <div className="form-card form-card--full">
          <h3 className="form-card__title">Dados</h3>
          <label>
            Referência
            <input value={reference} onChange={(e) => setReference(e.target.value)} disabled={m.isPending} />
            {fieldErrors.reference ? <span className="err">{fieldErrors.reference}</span> : null}
          </label>
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
            <input type="date" value={dueDate || defaultDue} onChange={(e) => setDueDate(e.target.value)} disabled={m.isPending} />
            {fieldErrors.due_date ? <span className="err">{fieldErrors.due_date}</span> : null}
          </label>
          <label>
            Cliente (opcional)
            <select
              value={portalClienteId}
              onChange={(e) => setPortalClienteId(e.target.value)}
              disabled={m.isPending || clientesQ.isLoading}
            >
              <option value="">— Não associar —</option>
              {(clientesQ.data?.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.documento})
                </option>
              ))}
            </select>
            {fieldErrors.portal_cliente_id ? <span className="err">{fieldErrors.portal_cliente_id}</span> : null}
          </label>
        </div>
        {apiError ? <div className="banner-err form-card--full">{apiError}</div> : null}
        <div className="form-actions form-card--full">
          <button type="submit" className="btn-primary" disabled={m.isPending}>
            {m.isPending ? "A gravar…" : "Criar cobrança"}
          </button>
          <Link to="/cobrancas" className="btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
