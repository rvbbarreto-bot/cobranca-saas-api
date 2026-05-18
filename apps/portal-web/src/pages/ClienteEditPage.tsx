import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clienteEditFormSchema } from "../lib/schemas";
import type { ClienteEditFormValues } from "../lib/schemas";
import { fetchClientes, patchPortalCliente } from "../lib/api";

export function ClienteEditPage(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["clientes"], queryFn: () => fetchClientes() });
  const cliente = id ? q.data?.data.find((c) => c.id === id) : undefined;

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (cliente) {
      setNome(cliente.nome);
      setEmail(cliente.email ?? "");
      setWhatsappOptIn(cliente.whatsapp_opt_in);
    }
  }, [cliente]);

  const m = useMutation({
    mutationFn: (body: ClienteEditFormValues) => patchPortalCliente(id!, body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clientes"] });
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
      email: email || undefined,
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
    m.mutate(parsed.data);
  }

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <div>
          <h2 className="shell-page__title">Edição do cliente</h2>
          <p className="shell-page__desc" style={{ marginBottom: 0 }}>
            Atualização via <code style={{ fontSize: "0.85em" }}>PATCH /v1/portal/clientes/:id</code>. O documento não
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

      {q.isLoading ? <p className="muted">Carregando…</p> : null}
      {q.isError ? (
        <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro"}</div>
      ) : null}
      {!q.isLoading && q.data && !cliente ? (
        <div className="banner-err">Cliente não encontrado neste escritório.</div>
      ) : null}

      {cliente ? (
        <form onSubmit={onSubmit} className="form-grid-proto" style={{ maxWidth: "720px" }}>
          <div className="form-card form-card--full">
            <h3 className="form-card__title">Identificação (somente leitura)</h3>
            <p style={{ margin: "0 0 0.75rem", fontSize: "0.88rem" }}>
              <span className="muted">Documento:</span>{" "}
              <strong style={{ fontVariantNumeric: "tabular-nums" }}>{cliente.documento}</strong>
            </p>
          </div>
          <div className="form-card">
            <h3 className="form-card__title">Dados cadastrais</h3>
            <label>
              Razão social / nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} disabled={m.isPending} />
              {fieldErrors.nome ? <span className="err">{fieldErrors.nome}</span> : null}
            </label>
            <label>
              E-mail
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={m.isPending} />
              {fieldErrors.email ? <span className="err">{fieldErrors.email}</span> : null}
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
                disabled={m.isPending}
              />
              Opt-in WhatsApp
            </label>
          </div>
          <div className="form-card">
            <h3 className="form-card__title">Observações</h3>
            <p className="form-note" style={{ margin: 0 }}>
              Demais blocos do protótipo (endereço, regra de cobrança) permanecem no cadastro visual até existirem
              campos na API.
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
