import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCliente } from "../hooks/useCliente";
import { invalidateClientesQueries } from "../lib/cliente-query-keys";
import { buildClienteEnderecoPayload } from "../lib/cliente-form-address";
import { maskBrPhone, maskCep } from "../lib/format-br";
import { BR_UFS } from "../lib/br-states";
import { onlyDigits } from "../lib/br-tax-id";
import { clienteEditFormSchema, normalizeClienteEditPayload } from "../lib/schemas";
import { fetchViaCep } from "../lib/viacep";
import { PortalValidationError, patchPortalCliente } from "../lib/api";

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
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [bairro, setBairro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (cliente) {
      setNome(cliente.nome);
      setEmail(cliente.email ?? "");
      setTelefone(cliente.telefone ? maskBrPhone(cliente.telefone) : "");
      setWhatsappOptIn(cliente.whatsapp_opt_in);
      const addr = cliente.endereco;
      if (addr) {
        setCep(maskCep(addr.cep));
        setLogradouro(addr.logradouro);
        setBairro(addr.bairro);
        setNumero(addr.numero ?? "");
        setComplemento(addr.complemento ?? "");
        setCidade(addr.cidade);
        setUf(addr.uf);
      } else {
        setCep("");
        setLogradouro("");
        setBairro("");
        setNumero("");
        setComplemento("");
        setCidade("");
        setUf("");
      }
    }
  }, [cliente]);

  const m = useMutation({
    mutationFn: (body: ReturnType<typeof normalizeClienteEditPayload>) => patchPortalCliente(id!, body),
    onSuccess: async () => {
      await invalidateClientesQueries(qc);
      navigate(`/clientes/${id}`, { replace: true });
    },
    onError: (e: unknown) => {
      if (e instanceof PortalValidationError && e.issues.length > 0) {
        const fe: Record<string, string> = {};
        for (const issue of e.issues) {
          if (issue.path && !fe[issue.path]) {
            fe[issue.path] = issue.message;
          }
        }
        setFieldErrors(fe);
        setApiError(e.issues.map((i) => i.message).join(" "));
        return;
      }
      setApiError(e instanceof Error ? e.message : "Erro ao salvar");
    }
  });

  async function onCepBlur(): Promise<void> {
    const digits = onlyDigits(cep);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.cep;
      return next;
    });
    if (digits.length === 0) {
      return;
    }
    if (digits.length !== 8) {
      setFieldErrors((prev) => ({ ...prev, cep: "CEP deve ter 8 digitos." }));
      return;
    }
    setCepLoading(true);
    try {
      const data = await fetchViaCep(digits);
      if (!data?.logradouro) {
        setFieldErrors((prev) => ({ ...prev, cep: "CEP nao encontrado." }));
        return;
      }
      setLogradouro(data.logradouro);
      setBairro(data.bairro ?? "");
      setCidade(data.localidade);
      setUf(data.uf);
    } catch {
      setFieldErrors((prev) => ({ ...prev, cep: "Falha ao consultar CEP. Tente novamente." }));
    } finally {
      setCepLoading(false);
    }
  }

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

    const addr = buildClienteEnderecoPayload({
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf
    });
    if (addr.fieldErrors) {
      setFieldErrors(addr.fieldErrors);
      return;
    }

    setFieldErrors({});
    m.mutate(normalizeClienteEditPayload(parsed.data, addr.endereco));
  }

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <div>
          <h2 className="shell-page__title">Edicao do cliente</h2>
          <p className="shell-page__desc" style={{ marginBottom: 0 }}>
            Atualizacao via <code style={{ fontSize: "0.85em" }}>PATCH /v1/portal/clientes/:id</code>. O documento nao
            pode ser alterado. Endereco e gravado quando CEP, logradouro, bairro, cidade e UF estiverem completos.
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
        <form onSubmit={onSubmit} className="form-grid-proto">
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
            <h3 className="form-card__title">Endereco</h3>
            <p className="form-note form-note--block">
              Necessario para emissao de boleto em bancos como Inter, Cora e C6.
            </p>
            <label>
              CEP
              <input
                value={cep}
                onChange={(e) => setCep(maskCep(e.target.value))}
                onBlur={() => void onCepBlur()}
                disabled={m.isPending || cepLoading}
                placeholder="00000-000"
                inputMode="numeric"
              />
              {cepLoading ? <span className="form-note">Consultando CEP…</span> : null}
              {fieldErrors.cep ? <span className="err">{fieldErrors.cep}</span> : null}
            </label>
            <label>
              Logradouro
              <input
                value={logradouro}
                onChange={(e) => setLogradouro(e.target.value)}
                disabled={m.isPending}
                maxLength={150}
              />
            </label>
            <label>
              Bairro
              <input value={bairro} onChange={(e) => setBairro(e.target.value)} disabled={m.isPending} maxLength={80} />
            </label>
            {fieldErrors.endereco ? <span className="err">{fieldErrors.endereco}</span> : null}
            <label>
              Numero
              <input value={numero} onChange={(e) => setNumero(e.target.value)} disabled={m.isPending} maxLength={20} />
            </label>
            <label>
              Complemento
              <input
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                disabled={m.isPending}
                maxLength={80}
              />
            </label>
            <label>
              Cidade
              <input value={cidade} onChange={(e) => setCidade(e.target.value)} disabled={m.isPending} maxLength={80} />
            </label>
            <label>
              UF
              <select value={uf} onChange={(e) => setUf(e.target.value)} disabled={m.isPending}>
                <option value="">Selecione…</option>
                {BR_UFS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="form-card form-card--full">
            <p className="form-note" style={{ margin: 0 }}>
              Regra de cobranca recorrente permanece em desenvolvimento (ver ADR em docs).
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
