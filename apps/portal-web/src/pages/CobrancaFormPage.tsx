import { FormEvent, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BrDatePicker } from "../components/BrDatePicker";
import { ClienteAutocomplete } from "../components/ClienteAutocomplete";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { CurrencyInput } from "../components/CurrencyInput";
import { useToast } from "../components/ToastProvider";
import { buildCobrancaFormSchema, getPortalChargeRules, normalizeCobrancaPayload } from "../lib/cobranca-form";
import { defaultDueDateIso, sanitizeChargeReference } from "../lib/gateway-charge-rules";
import { clienteDetailQueryKey } from "../lib/cliente-query-keys";
import { fetchClienteById, fetchEscritorioConfig, postPortalCobranca } from "../lib/api";

function newIdempotencyKey(): string {
  const r =
    typeof globalThis.crypto !== "undefined" && "randomUUID" in globalThis.crypto
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  return `portal-${Date.now()}-${r}`.slice(0, 128);
}

function formIsDirty(fields: {
  reference: string;
  amountDisplay: string;
  portalClienteId: string;
  dueIso: string;
  defaultDue: string;
}): boolean {
  return (
    fields.reference.trim().length > 0 ||
    fields.amountDisplay.trim().length > 0 ||
    fields.portalClienteId.trim().length > 0 ||
    fields.dueIso !== fields.defaultDue
  );
}

export function CobrancaFormPage(): JSX.Element {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [searchParams] = useSearchParams();
  const preClienteId = searchParams.get("clienteId")?.trim() || "";

  const configQ = useQuery({ queryKey: ["escritorio-config"], queryFn: fetchEscritorioConfig });
  const gatewayKey = configQ.data?.config?.gateway_provider ?? "asaas";
  const rules = useMemo(() => getPortalChargeRules(gatewayKey), [gatewayKey]);
  const schema = useMemo(() => buildCobrancaFormSchema(rules), [rules]);

  const defaultDue = useMemo(() => defaultDueDateIso(30), []);

  const preClienteQ = useQuery({
    queryKey: clienteDetailQueryKey(preClienteId || "none"),
    enabled: Boolean(preClienteId),
    queryFn: () => fetchClienteById(preClienteId)
  });

  const [reference, setReference] = useState("");
  const [amountDisplay, setAmountDisplay] = useState("");
  const [amountValue, setAmountValue] = useState<number | null>(null);
  const [dueIso, setDueIso] = useState(defaultDue);
  const [portalClienteId, setPortalClienteId] = useState(preClienteId);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);

  const idempotencyRef = useRef<string | null>(null);
  const submitLockRef = useRef(false);

  const m = useMutation({
    mutationFn: (body: Parameters<typeof postPortalCobranca>[0]) => postPortalCobranca(body),
    onSuccess: async (data) => {
      showToast("Cobranca criada com sucesso");
      await qc.invalidateQueries({ queryKey: ["cobrancas"] });
      await qc.invalidateQueries({ queryKey: ["clienteCobrancas"] });
      const id = data.charge.id;
      navigate(id ? `/cobrancas/${encodeURIComponent(id)}` : "/cobrancas", { replace: true });
    },
    onError: (e: unknown) => {
      submitLockRef.current = false;
      idempotencyRef.current = null;
      setApiError(e instanceof Error ? e.message : "Erro ao criar cobranca");
    },
    onSettled: () => {
      submitLockRef.current = false;
    }
  });

  const isSubmitting = m.isPending || submitLockRef.current;

  function onReferenceChange(raw: string): void {
    setReference(sanitizeChargeReference(raw, rules));
  }

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    if (submitLockRef.current || m.isPending) {
      return;
    }
    setApiError(null);

    const amount = amountValue ?? 0;
    const parsed = schema.safeParse({
      reference,
      amount,
      due_date: dueIso,
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
    submitLockRef.current = true;
    if (!idempotencyRef.current) {
      idempotencyRef.current = newIdempotencyKey();
    }

    const payload = normalizeCobrancaPayload(parsed.data, rules);
    m.mutate({
      ...payload,
      idempotency_key: idempotencyRef.current
    });
  }

  function requestCancel(): void {
    if (
      formIsDirty({
        reference,
        amountDisplay,
        portalClienteId,
        dueIso,
        defaultDue
      })
    ) {
      setCancelOpen(true);
      return;
    }
    navigate("/cobrancas");
  }

  const infoText = `A cobranca e criada em rascunho e a emissao no gateway (${rules.displayName}) ocorre em segundo plano. Se o gateway estiver temporariamente indisponivel, o titulo permanece pendente e sera reprocessado automaticamente.`;

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <h2 className="shell-page__title">Nova cobranca avulsa</h2>
        <button type="button" className="btn-secondary" onClick={requestCancel} disabled={isSubmitting}>
          Voltar
        </button>
      </div>
      <p className="muted">{infoText}</p>

      <form onSubmit={onSubmit} className="form-grid" noValidate>
        <div className="form-card form-card--full">
          <h3 className="form-card__title">Dados da cobranca</h3>

          <label htmlFor="cobranca-reference">
            Referencia / Descricao
            <span className="field-required" aria-hidden="true">
              {" "}
              *
            </span>
            <input
              id="cobranca-reference"
              value={reference}
              onChange={(e) => onReferenceChange(e.target.value)}
              disabled={isSubmitting}
              required
              maxLength={rules.referenceMaxLength}
              placeholder="Ex: Mensalidade junho, NF-1234, Contrato #99"
              aria-describedby="cobranca-reference-hint"
            />
          </label>
          <p id="cobranca-reference-hint" className="form-note">
            Maximo {rules.referenceMaxLength} caracteres
            {rules.referenceAlphanumericOnly ? " (somente letras, numeros e espacos — Banco Inter)" : ""}.
            {reference.length > 0 ? ` ${reference.length}/${rules.referenceMaxLength}` : null}
          </p>
          {fieldErrors.reference ? <span className="err">{fieldErrors.reference}</span> : null}

          <label htmlFor="cobranca-amount">
            Valor (R$)
            <span className="field-required" aria-hidden="true">
              {" "}
              *
            </span>
            <CurrencyInput
              id="cobranca-amount"
              value={amountDisplay}
              onChange={(display, n) => {
                setAmountDisplay(display);
                setAmountValue(n);
              }}
              disabled={isSubmitting}
              required
            />
          </label>
          {fieldErrors.amount ? <span className="err">{fieldErrors.amount}</span> : null}

          <BrDatePicker
            id="cobranca-due"
            label="Vencimento"
            valueIso={dueIso}
            onChangeIso={setDueIso}
            rules={rules}
            disabled={isSubmitting}
            required
            error={fieldErrors.due_date}
          />

          <ClienteAutocomplete
            id="cobranca-cliente"
            label={rules.requiresPayer ? "Cliente (pagador obrigatório)" : "Cliente (opcional)"}
            value={portalClienteId}
            onChange={(id) => setPortalClienteId(id)}
            disabled={isSubmitting}
            required={rules.requiresPayer}
            error={fieldErrors.portal_cliente_id}
            initialCliente={preClienteQ.data ?? null}
          />
        </div>

        {apiError ? <div className="banner-err form-card--full">{apiError}</div> : null}

        <div className="form-actions form-card--full">
          <button type="submit" className="btn-primary" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? "Criando…" : "Criar cobranca"}
          </button>
          <button type="button" className="btn-ghost" onClick={requestCancel} disabled={isSubmitting}>
            Cancelar
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={cancelOpen}
        title="Descartar cobranca?"
        message="Tem certeza? Os dados preenchidos nesta cobranca serao perdidos."
        confirmLabel="Sim, sair"
        cancelLabel="Continuar editando"
        onConfirm={() => navigate("/cobrancas")}
        onCancel={() => setCancelOpen(false)}
      />
    </div>
  );
}
