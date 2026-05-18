import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clienteFormSchema, normalizeClientePayload } from "../lib/schemas";
import type { CreateClienteBody } from "../lib/api";
import { postCliente } from "../lib/api";

export function ClienteFormPage(): JSX.Element {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"PJ" | "PF">("PJ");
  const [documento, setDocumento] = useState("");
  const [nome, setNome] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappText, setWhatsappText] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [obsEndereco, setObsEndereco] = useState("");
  const [mensalidade, setMensalidade] = useState("");
  const [vencimentoDia, setVencimentoDia] = useState("");
  const [banco, setBanco] = useState("");
  const [descricaoCobranca, setDescricaoCobranca] = useState("");
  const [mesReferencia, setMesReferencia] = useState("Automático");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const m = useMutation({
    mutationFn: (body: CreateClienteBody) => postCliente(body),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["clientes"] });
      navigate("/clientes", { replace: true });
    },
    onError: (e: unknown) => {
      setApiError(e instanceof Error ? e.message : "Erro ao salvar");
    }
  });

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    setApiError(null);
    const parsed = clienteFormSchema.safeParse({
      documento,
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
    m.mutate(normalizeClientePayload(parsed.data));
  }

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <div>
          <h2 className="shell-page__title">Cadastro / edição do cliente</h2>
          <p className="shell-page__desc" style={{ marginBottom: 0 }}>
            Layout alinhado ao protótipo. Apenas identificação e contato assinalados abaixo são persistidos na API
            atual (`POST /v1/portal/clientes`). Os demais campos acompanham o roadmap de produto.
          </p>
        </div>
        <Link to="/clientes" className="btn-secondary">
          Voltar
        </Link>
      </div>

      <form onSubmit={onSubmit} className="form-grid-proto">
        <div className="form-card">
          <h3 className="form-card__title">Identificação</h3>
          <label>
            Tipo
            <select value={tipo} onChange={(e) => setTipo(e.target.value as "PJ" | "PF")} disabled={m.isPending}>
              <option value="PJ">PJ</option>
              <option value="PF">PF</option>
            </select>
          </label>
          <label>
            CPF / CNPJ
            <input value={documento} onChange={(e) => setDocumento(e.target.value)} disabled={m.isPending} />
            {fieldErrors.documento ? <span className="err">{fieldErrors.documento}</span> : null}
          </label>
          <label>
            Razão social
            <input value={nome} onChange={(e) => setNome(e.target.value)} disabled={m.isPending} />
            {fieldErrors.nome ? <span className="err">{fieldErrors.nome}</span> : null}
          </label>
          <label>
            Nome fantasia
            <input value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} disabled={m.isPending} />
            <p className="form-note">Somente visual nesta versão (não enviado à API).</p>
          </label>
        </div>

        <div className="form-card">
          <h3 className="form-card__title">Contato</h3>
          <label>
            Responsável
            <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} disabled={m.isPending} />
            <p className="form-note">Somente visual nesta versão.</p>
          </label>
          <label>
            E-mail
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={m.isPending} />
            {fieldErrors.email ? <span className="err">{fieldErrors.email}</span> : null}
          </label>
          <label>
            WhatsApp
            <input value={whatsappText} onChange={(e) => setWhatsappText(e.target.value)} disabled={m.isPending} />
            <p className="form-note">Texto livre no protótipo; o envio à API usa apenas o opt-in abaixo.</p>
          </label>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={whatsappOptIn}
              onChange={(e) => setWhatsappOptIn(e.target.checked)}
              disabled={m.isPending}
            />
            Cliente autoriza contato via WhatsApp (opt-in)
          </label>
        </div>

        <div className="form-card">
          <h3 className="form-card__title">Endereço</h3>
          <label>
            CEP
            <input value={cep} onChange={(e) => setCep(e.target.value)} disabled={m.isPending} />
          </label>
          <label>
            Logradouro
            <input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} disabled={m.isPending} />
          </label>
          <label>
            Cidade
            <input value={cidade} onChange={(e) => setCidade(e.target.value)} disabled={m.isPending} />
          </label>
          <label>
            UF
            <input value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} disabled={m.isPending} />
          </label>
          <label>
            Observação
            <textarea value={obsEndereco} onChange={(e) => setObsEndereco(e.target.value)} disabled={m.isPending} />
          </label>
          <p className="form-note">Endereço não persistido nesta versão da API.</p>
        </div>

        <div className="form-card">
          <h3 className="form-card__title">Regra de cobrança</h3>
          <label>
            Mensalidade
            <input value={mensalidade} onChange={(e) => setMensalidade(e.target.value)} disabled={m.isPending} placeholder="R$ 590,00" />
          </label>
          <label>
            Vencimento
            <input value={vencimentoDia} onChange={(e) => setVencimentoDia(e.target.value)} disabled={m.isPending} placeholder="Dia 05" />
          </label>
          <label>
            Banco
            <input value={banco} onChange={(e) => setBanco(e.target.value)} disabled={m.isPending} />
          </label>
          <label>
            Descrição
            <input value={descricaoCobranca} onChange={(e) => setDescricaoCobranca(e.target.value)} disabled={m.isPending} />
          </label>
          <label>
            Mês referência
            <input value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} disabled={m.isPending} />
          </label>
          <p className="form-note">Regras de cobrança recorrente serão persistidas quando o backend expuser o contrato.</p>
          <div className="form-actions" style={{ marginTop: "1rem", justifyContent: "flex-end" }}>
            <Link to="/clientes" className="btn-ghost">
              Cancelar
            </Link>
            <button type="submit" className="btn-cyan" disabled={m.isPending}>
              {m.isPending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </div>

        {apiError ? <div className="banner-err form-card--full">{apiError}</div> : null}
      </form>
    </div>
  );
}
