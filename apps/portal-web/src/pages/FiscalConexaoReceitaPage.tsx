import { FormEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiscalAdminGate } from "../components/FiscalAdminGate";
import { ApiError, fetchSerproConfig, patchSerproConfig } from "../lib/api";
import { formatFiscalConfigDateTime } from "../lib/fiscal-config-ui";
import {
  buildPatchSerproConfigBody,
  formatContratanteCnpjInput,
  SERPRO_AMBIENTE_OPTIONS,
  serproAmbienteLabel,
  serproConfigToFormState,
  serproContratanteDisplay,
  serproCredentialDisplay,
  shouldStartSerproViewMode,
  validateSerproConfigForm,
  type SerproConfigFormState
} from "../lib/serpro-config-ui";

const FORM_ID = "fiscal-conexao-receita-form";

function SerproConfigForm(): JSX.Element {
  const queryClient = useQueryClient();
  const viewModeInitialized = useRef(false);
  const [isEditing, setIsEditing] = useState(true);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [form, setForm] = useState<SerproConfigFormState>(serproConfigToFormState(null));

  const configQ = useQuery({
    queryKey: ["serproConfig"],
    queryFn: fetchSerproConfig
  });

  const config = configQ.data?.serpro_config;
  const viewMode = shouldStartSerproViewMode(config) && !isEditing;

  useEffect(() => {
    if (!config) return;
    if (!viewModeInitialized.current) {
      viewModeInitialized.current = true;
      setForm(serproConfigToFormState(config));
      setIsEditing(!shouldStartSerproViewMode(config));
    }
  }, [config]);

  const save = useMutation({
    mutationFn: () => {
      const err = validateSerproConfigForm(form, config);
      if (err) {
        return Promise.reject(new Error(err));
      }
      return patchSerproConfig(buildPatchSerproConfigBody(form, config));
    },
    onSuccess: async (data) => {
      setSaveErr(null);
      setSaveMsg("Conexão Receita Federal guardada.");
      queryClient.setQueryData(["serproConfig"], data);
      setForm(serproConfigToFormState(data.serpro_config));
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["serproConfig"] });
    },
    onError: (err: unknown) => {
      setSaveMsg(null);
      setSaveErr(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Falha ao guardar.");
    }
  });

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    setSaveMsg(null);
    setSaveErr(null);
    save.mutate();
  }

  function startEdit(): void {
    setSaveMsg(null);
    setSaveErr(null);
    setForm(serproConfigToFormState(config));
    setIsEditing(true);
  }

  if (configQ.isLoading) {
    return <p className="muted">A carregar configuração…</p>;
  }

  if (configQ.isError) {
    return (
      <div className="banner-err" role="alert">
        {configQ.error instanceof Error ? configQ.error.message : "Erro ao carregar configuração SERPRO."}
      </div>
    );
  }

  return (
    <div className="form-card fiscal-conexao-card">
      <div className="fiscal-conexao-card__head">
        <div>
          <h3 style={{ marginTop: 0 }}>Integração Integra Contador</h3>
          <p className="muted" style={{ margin: 0 }}>
            Credenciais OAuth SERPRO para transmissão PGDASD. Em homologação interna, a API pode usar mock (
            <code>FISCAL_SERPRO_MOCK=true</code>).
          </p>
        </div>
        {viewMode ? (
          <button type="button" className="btn-secondary" onClick={startEdit}>
            Editar
          </button>
        ) : null}
      </div>

      {viewMode ? (
        <dl className="fiscal-conexao-dl">
          <div>
            <dt>Ambiente</dt>
            <dd>{serproAmbienteLabel(config?.ambiente ?? "demo")}</dd>
          </div>
          <div>
            <dt>CNPJ contratante</dt>
            <dd>{serproContratanteDisplay(config)}</dd>
          </div>
          <div>
            <dt>Consumer key</dt>
            <dd>{serproCredentialDisplay(Boolean(config?.consumer_key_configured))}</dd>
          </div>
          <div>
            <dt>Consumer secret</dt>
            <dd>{serproCredentialDisplay(Boolean(config?.consumer_secret_configured))}</dd>
          </div>
          <div>
            <dt>Conexão ativa</dt>
            <dd>
              <span className={`status-pill ${config?.serpro_enabled ? "status-pill--ativo" : "status-pill--rascunho"}`}>
                {config?.serpro_enabled ? "Ativa" : "Desligada"}
              </span>
            </dd>
          </div>
          {config?.updated_at ? (
            <div>
              <dt>Atualizado em</dt>
              <dd>{formatFiscalConfigDateTime(config.updated_at)}</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <form id={FORM_ID} onSubmit={handleSubmit} className="fiscal-conexao-form">
          <fieldset className="fiscal-conexao-form__ambiente">
            <legend className="field-label">Ambiente</legend>
            {SERPRO_AMBIENTE_OPTIONS.map((opt) => (
              <label key={opt.value} className="fiscal-conexao-form__radio">
                <input
                  type="radio"
                  name="ambiente"
                  value={opt.value}
                  checked={form.ambiente === opt.value}
                  onChange={() => setForm((f) => ({ ...f, ambiente: opt.value }))}
                />
                <span>
                  <strong>{opt.label}</strong>
                  <span className="muted" style={{ display: "block", fontSize: "0.85rem" }}>
                    {opt.hint}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>

          <label className="field-label">
            CNPJ contratante SERPRO
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="00.000.000/0000-00"
              value={form.contratanteCnpj}
              onChange={(e) => setForm((f) => ({ ...f, contratanteCnpj: formatContratanteCnpjInput(e.target.value) }))}
              aria-describedby="contratante-cnpj-hint"
            />
          </label>
          <p id="contratante-cnpj-hint" className="muted" style={{ fontSize: "0.85rem", marginTop: "-0.35rem" }}>
            {config?.contratante_cnpj?.includes("*")
              ? `Cadastrado: ${config.contratante_cnpj}. Informe o CNPJ completo para confirmar alterações.`
              : "CNPJ da empresa contratante do serviço Integra Contador na SERPRO."}
          </p>

          <label className="field-label">
            Consumer key
            <input
              type="password"
              autoComplete="off"
              placeholder={config?.consumer_key_configured ? "Deixe em branco para manter" : "Mín. 8 caracteres"}
              value={form.consumerKey}
              onChange={(e) => setForm((f) => ({ ...f, consumerKey: e.target.value }))}
            />
          </label>

          <label className="field-label">
            Consumer secret
            <input
              type="password"
              autoComplete="off"
              placeholder={config?.consumer_secret_configured ? "Deixe em branco para manter" : "Mín. 8 caracteres"}
              value={form.consumerSecret}
              onChange={(e) => setForm((f) => ({ ...f, consumerSecret: e.target.value }))}
            />
          </label>

          <label className="fiscal-conexao-form__toggle">
            <input
              type="checkbox"
              checked={form.serproEnabled}
              onChange={(e) => setForm((f) => ({ ...f, serproEnabled: e.target.checked }))}
            />
            <span>
              <strong>Ativar conexão oficial</strong>
              <span className="muted" style={{ display: "block", fontSize: "0.85rem" }}>
                Quando desligada, a API usa mock interno se <code>FISCAL_SERPRO_MOCK=true</code>.
              </span>
            </span>
          </label>

          <div className="fiscal-conexao-form__actions">
            {shouldStartSerproViewMode(config) ? (
              <button type="button" className="btn-secondary" onClick={() => setIsEditing(false)}>
                Cancelar
              </button>
            ) : null}
            <button type="submit" className="btn-primary" disabled={save.isPending}>
              {save.isPending ? "A guardar…" : "Guardar conexão"}
            </button>
          </div>
        </form>
      )}

      {saveMsg ? (
        <p className="form-success" role="status">
          {saveMsg}
        </p>
      ) : null}
      {saveErr ? (
        <p className="form-error" role="alert">
          {saveErr}
        </p>
      ) : null}
    </div>
  );
}

export function FiscalConexaoReceitaPage(): JSX.Element {
  return (
    <FiscalAdminGate
      title="Conexão Receita Federal"
      description="Credenciais Integra Contador (SERPRO) — ambiente demo ou produção e CNPJ contratante."
    >
      <SerproConfigForm />
    </FiscalAdminGate>
  );
}
