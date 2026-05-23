import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCliente } from "../hooks/useCliente";
import { invalidateClientesQueries } from "../lib/cliente-query-keys";
import { maskBrPhone } from "../lib/format-br";
import { clienteEditFormSchema, normalizeClienteEditPayload } from "../lib/schemas";
import { patchPortalCliente } from "../lib/api";

export function ClienteEditPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const clienteQ = useCliente(id);
  const cliente = clienteQ.data ?? undefined;

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (cliente) {
      setNome(cliente.nome);
      setEmail(cliente.email ?? "");
      setTelefone(cliente.telefone ? maskBrPhone(cliente.telefone) : "");
      setWhatsappOptIn(cliente.whatsapp_opt_in);
    }
  }, [cliente]);

  const m = useMutation({
    mutationFn: (body: ReturnType<typeof normalizeClienteEditPayload>) => patchPortalCliente(id!, body),
    onSuccess: async () => {
      await invalidateClientesQueries(qc);
      navigate(`/clientes/${id}`, { replace: true });
    },
    onError: (e: unknown) => {
      setApiError(e instanceof Error ? e.message : "Erro ao salvar");
    }
  });

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!id) {
      return;
    }
    setApiError(null);
    const parsed = clienteEditFormSchema.safeParse({
      nome,
      email,
      telefone: telefone || undefined,
      whatsapp_opt_in: whatsappOptIn
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
    m.mutate(normalizeClienteEditPayload(parsed.data));
  }

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <div>
          <h2 className="shell-page__title">Edicao do cliente</h2>
          <p className="shell-page__desc" style={{ marginBottom: 0 }}>
            Atualizacao via <code style={{ fontSize: "0.85em" }}>PATCH /v1/portal/clientes/:id</code>. O documento nao
            pode ser alterado.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {id ? (
            <Link to={`/clientes/${id}`} className="btn-secondary">
              Cancelar
            </Link>
          ) : null}
        </div>
      </div>

      {clienteQ.isLoading ? <p className="muted">Carregando…</p> : null}
      {clienteQ.isError ? (
        <div className="banner-err">{clienteQ.error instanceof Error ? clienteQ.error.message : "Erro"}</div>
      ) : null}
      {!clienteQ.isLoading && clienteQ.isSuccess && !cliente ? (
        <div className="banner-err">Cliente nao encontrado neste escritorio.</div>
      ) : null}

      {cliente ? (
        <form onSubmit={onSubmit} className="form-grid-proto" style={{ maxWidth: "720px" }}>
          <div className="form-card form-card--full">
            <h3 className="form-card__title">Identificacao (somente leitura)</h3>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.88rem" }}>
              <span className="muted">Documento:</span>{" "}
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{cliente.documento}</strong>
            </p>
          </div>
          <div className="form-card">
            <h3 className="form-card__title">Dados cadastrais</h3>
            <label htmlFor="cliente-edit-nome">
              Nome / razao social
              <input
                id="cliente-edit-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={m.isPending}
                maxLength={100}
              />
              {fieldErrors.nome ? <span className="err">{fieldErrors.nome}</span> : null}
            </label>
            <label htmlFor="cliente-edit-email">
              E-mail
              <input
                id="cliente-edit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={m.isPending}
                maxLength={254}
                required
              />
              {fieldErrors.email ? <span className="err">{fieldErrors.email}</span> : null}
            </label>
            <label htmlFor="cliente-edit-telefone">
              WhatsApp
              <input
                id="cliente-edit-telefone"
                value={telefone}
                onChange={(e) => setTelefone(maskBrPhone(e.target.value))}
                disabled={m.isPending}
                placeholder="(00) 00000-0000"
              />
              {fieldErrors.telefone ? <span className="err">{fieldErrors.telefone}</span> : null}
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                disabled={m.isPending}
              />
              <span>Autorizo comunicacoes via WhatsApp (LGPD — opt-in explicito)</span>
            </label>
          </div>
          <div className="form-card">
            <h3 className="form-card__title">Observacoes</h3>
            <p className="form-note" style={{ margin: 0 }}>
              Endereco e regra de cobranca recorrente permanecem no cadastro completo (Em breve na API).
            </p>
            <div className="form-actions" style={{ marginTop: "1rem" }}>
              <Link to={`/clientes/${cliente.id}`} className="btn-ghost">
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
