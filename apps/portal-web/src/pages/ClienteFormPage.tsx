import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { EmBreveSection } from "../components/EmBreveSection";
import { BR_UFS } from "../lib/br-states";
import { onlyDigits } from "../lib/br-tax-id";
import { maskBrPhone, maskCep, maskDocumento } from "../lib/format-br";
import { invalidateClientesQueries } from "../lib/cliente-query-keys";
import { clienteFormSchema, normalizeClientePayload } from "../lib/schemas";
import type { CreateClienteBody } from "../lib/api";
import { fetchEscritorioConfig, postCliente } from "../lib/api";
import { fetchViaCep } from "../lib/viacep";

const GATEWAY_LABELS: Record<string, string> = {
  inter: "Banco Inter",
  cora: "Cora",
  asaas: "Asaas",
  pagarme: "Pagar.me"
};

function CharCounter({ value, max }: { value: string; max: number }): JSX.Element {
  return (
    <span className="char-counter" aria-live="polite">
      {value.length}/{max}
    </span>
  );
}

export function ClienteFormPage(): JSX.Element {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"" | "PF" | "PJ">("");
  const [documento, setDocumento] = useState("");
  const [nome, setNome] = useState("");
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [email, setEmail] = useState("");
  const [whatsappText, setWhatsappText] = useState("");
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [cep, setCep] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [obsEndereco, setObsEndereco] = useState("");
  const [mensalidade, setMensalidade] = useState("");
  const [vencimentoDia, setVencimentoDia] = useState("");
  const [descricaoCobranca, setDescricaoCobranca] = useState("");
  const [mesReferencia, setMesReferencia] = useState("automatico");
  const [cepLoading, setCepLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);

  const configQ = useQuery({ queryKey: ["escritorio-config"], queryFn: fetchEscritorioConfig });
  const gatewayKey = configQ.data?.config?.gateway_provider?.trim() ?? "";
  const gatewayLabel = gatewayKey ? (GATEWAY_LABELS[gatewayKey] ?? gatewayKey) : "Nao configurado";

  const m = useMutation({
    mutationFn: (body: CreateClienteBody) => postCliente(body),
    onSuccess: async () => {
      await invalidateClientesQueries(qc);
      navigate("/clientes", { replace: true });
    },
    onError: (e: unknown) => {
      setApiError(e instanceof Error ? e.message : "Erro ao salvar");
    }
  });

  function onTipoChange(next: "" | "PF" | "PJ"): void {
    setTipo(next);
    if (next && documento) {
      const d = onlyDigits(documento);
      const ok = (next === "PF" && d.length <= 11) || (next === "PJ" && d.length <= 14);
      if (!ok) {
        setDocumento("");
      } else if (next === "PF" || next === "PJ") {
        setDocumento(maskDocumento(next, documento));
      }
    }
  }

  function onDocumentoChange(raw: string): void {
    if (tipo === "PF" || tipo === "PJ") {
      setDocumento(maskDocumento(tipo, raw));
    } else {
      setDocumento(raw);
    }
  }

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
    setApiError(null);
    if (!tipo) {
      setFieldErrors({ tipo: "Selecione Pessoa Fisica ou Pessoa Juridica." });
      return;
    }
    const parsed = clienteFormSchema.safeParse({
      tipo,
      documento,
      nome,
      email,
      telefone: whatsappText || undefined,
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
    const cepDigits = onlyDigits(cep);
    const hasAddr =
      cepDigits.length > 0 ||
      logradouro.trim().length > 0 ||
      bairro.trim().length > 0 ||
      cidade.trim().length > 0 ||
      uf.trim().length > 0;
    let enderecoPayload: ReturnType<typeof normalizeClientePayload>["endereco"];
    if (hasAddr) {
      if (
        cepDigits.length !== 8 ||
        !logradouro.trim() ||
        !bairro.trim() ||
        !cidade.trim() ||
        uf.trim().length !== 2
      ) {
        setFieldErrors({
          cep: cepDigits.length !== 8 ? "CEP com 8 digitos." : "",
          endereco: "Preencha logradouro, bairro, cidade e UF para salvar o endereco."
        });
        return;
      }
      enderecoPayload = {
        cep: cepDigits,
        logradouro: logradouro.trim(),
        numero: numero.trim() || null,
        complemento: complemento.trim() || null,
        bairro: bairro.trim(),
        cidade: cidade.trim(),
        uf: uf.trim().toUpperCase()
      };
    }
    setFieldErrors({});
    m.mutate(normalizeClientePayload(parsed.data, enderecoPayload));
  }

  const nomeLabel = tipo === "PF" ? "Nome completo" : tipo === "PJ" ? "Razao social" : "Nome / razao social";
  const docLabel = tipo === "PF" ? "CPF" : tipo === "PJ" ? "CNPJ" : "CPF / CNPJ";
  const showFantasia = tipo === "PJ";

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <div>
          <h2 className="shell-page__title">Cadastro do cliente</h2>
          <p className="shell-page__desc" style={{ marginBottom: 0 }}>
            Identificacao e contato sao gravados na API (<code style={{ fontSize: "0.85em" }}>POST /v1/portal/clientes</code>
            ). Endereco e gravado na API quando CEP, logradouro, bairro, cidade e UF estiverem completos.
          </p>
        </div>
        <Link to="/clientes" className="btn-secondary">
          Voltar
        </Link>
      </div>

      <form onSubmit={onSubmit} className="form-grid-proto">
        <div className="form-card">
          <h3 className="form-card__title">Identificacao</h3>
          <label>
            Tipo
            <select
              value={tipo}
              onChange={(e) => onTipoChange(e.target.value as "" | "PF" | "PJ")}
              disabled={m.isPending}
              required
            >
              <option value="" disabled>
                Selecione…
              </option>
              <option value="PF">Pessoa Fisica</option>
              <option value="PJ">Pessoa Juridica</option>
            </select>
            {fieldErrors.tipo ? <span className="err">{fieldErrors.tipo}</span> : null}
          </label>
          <label>
            {docLabel}
            <input
              value={documento}
              onChange={(e) => onDocumentoChange(e.target.value)}
              onPaste={(e) => {
                e.preventDefault();
                const text = e.clipboardData.getData("text");
                onDocumentoChange(text);
              }}
              disabled={m.isPending || !tipo}
              placeholder={tipo === "PF" ? "000.000.000-00" : tipo === "PJ" ? "00.000.000/0000-00" : ""}
              inputMode="numeric"
              autoComplete="off"
            />
            {fieldErrors.documento ? <span className="err">{fieldErrors.documento}</span> : null}
          </label>
          <label>
            {nomeLabel}
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              disabled={m.isPending}
              maxLength={100}
            />
            {fieldErrors.nome ? <span className="err">{fieldErrors.nome}</span> : null}
          </label>
          {showFantasia ? (
            <label>
              Nome fantasia (opcional)
              <input
                value={nomeFantasia}
                onChange={(e) => setNomeFantasia(e.target.value)}
                disabled={m.isPending}
                maxLength={100}
              />
              <p className="form-note">Nao enviado a API nesta versao — apenas referencia visual.</p>
            </label>
          ) : null}
        </div>

        <div className="form-card">
          <h3 className="form-card__title">Contato</h3>
          <label>
            Responsavel
            <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} disabled={m.isPending} maxLength={100} />
            <p className="form-note">
              <span className="badge-em-breve badge-em-breve--inline">Em breve</span> — nao enviado a API.
            </p>
          </label>
          <label>
            E-mail
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={m.isPending}
              maxLength={254}
              required
              autoComplete="email"
            />
            <p className="form-note">Obrigatorio para envio de boletos e comunicacoes.</p>
            {fieldErrors.email ? <span className="err">{fieldErrors.email}</span> : null}
          </label>
          <label>
            WhatsApp
            <input
              value={whatsappText}
              onChange={(e) => setWhatsappText(maskBrPhone(e.target.value))}
              disabled={m.isPending}
              placeholder="(00) 00000-0000"
              inputMode="tel"
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
            <span>
              Autorizo o envio de comunicacoes via WhatsApp conforme a politica de privacidade
              {whatsappOptIn ? <span className="form-note form-note--inline"> — WhatsApp obrigatorio</span> : null}
            </span>
          </label>
        </div>

        <EmBreveSection
          title="Endereco"
          hint="Os campos abaixo permitem consulta de CEP (ViaCEP) para testar o fluxo, mas nao sao gravados nesta versao da API."
        >
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
            <input value={logradouro} onChange={(e) => setLogradouro(e.target.value)} disabled={m.isPending} maxLength={150} />
          </label>
          <label>
            Numero
            <input value={numero} onChange={(e) => setNumero(e.target.value)} disabled={m.isPending} maxLength={20} />
          </label>
          <label>
            Complemento
            <input value={complemento} onChange={(e) => setComplemento(e.target.value)} disabled={m.isPending} maxLength={80} />
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
          <label>
            Observacao
            <textarea
              value={obsEndereco}
              onChange={(e) => setObsEndereco(e.target.value)}
              disabled={m.isPending}
              maxLength={500}
            />
            <CharCounter value={obsEndereco} max={500} />
          </label>
        </EmBreveSection>

        <EmBreveSection
          title="Regra de cobranca"
          hint="Regras recorrentes (mensalidade, vencimento, descricao) serao persistidas quando o backend expuser o contrato. Nada desta secao e enviado ao salvar o cliente."
        >
          <label>
            Valor da mensalidade (R$)
            <input
              value={mensalidade}
              onChange={(e) => setMensalidade(e.target.value)}
              disabled
              placeholder="590,00"
            />
          </label>
          <label>
            Dia de vencimento
            <input
              type="number"
              min={1}
              max={28}
              value={vencimentoDia}
              onChange={(e) => setVencimentoDia(e.target.value)}
              disabled
              placeholder="1 a 28"
            />
            <p className="form-note">Dias 29–31 evitados (meses curtos).</p>
          </label>
          <label>
            Banco / gateway do escritorio
            <input value={gatewayLabel} readOnly disabled className="input-readonly" />
            <p className="form-note">
              Definido em Configuracoes do escritorio{gatewayKey ? ` (${gatewayKey})` : ""}. O cliente nao informa o banco
              manualmente.
            </p>
          </label>
          <label>
            Descricao no boleto (opcional)
            <input
              value={descricaoCobranca}
              onChange={(e) => setDescricaoCobranca(e.target.value.replace(/[^a-zA-Z0-9 ]/g, ""))}
              disabled
              maxLength={80}
            />
            <CharCounter value={descricaoCobranca} max={80} />
            <p className="form-note">Inter limita a 80 caracteres alfanumericos + espaco.</p>
          </label>
          <label>
            Mes referencia
            <select value={mesReferencia} onChange={(e) => setMesReferencia(e.target.value)} disabled>
              <option value="automatico">Automatico (mes da emissao)</option>
              <option value="manual">Manual (em breve)</option>
            </select>
          </label>
        </EmBreveSection>

        <div className="form-card form-card--full">
          <div className="form-actions">
            <Link to="/clientes" className="btn-ghost">
              Cancelar
            </Link>
            <button type="submit" className="btn-cyan" disabled={m.isPending}>
              {m.isPending ? "Salvando…" : "Salvar cliente"}
            </button>
          </div>
        </div>

        {apiError ? <div className="banner-err form-card--full">{apiError}</div> : null}
      </form>
    </div>
  );
}
