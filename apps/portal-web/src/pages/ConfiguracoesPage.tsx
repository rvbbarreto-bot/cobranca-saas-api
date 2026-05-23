import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  deleteChargingRule,
  fetchChargingRules,
  fetchCobrancas,
  fetchEscritorioConfig,
  fetchGatewayChangeHistory,
  fetchGatewayProviderSchema,
  fetchGatewayProviders,
  fetchNotificationTemplates,
  fetchPortalMe,
  patchChargingRule,
  patchEscritorioConfig,
  patchGatewayProvider,
  patchNotificationTemplate,
  postChargingRule,
  previewNotificationTemplate,
  shouldPatchSecret,
  type GatewayProviderMeta,
  type PatchEscritorioConfigBody
} from "../lib/api";

type TabId = "gateway" | "regua" | "templates";

function channelLabel(ch: string): string {
  if (ch === "both") return "E-mail + WhatsApp";
  if (ch === "whatsapp") return "WhatsApp";
  return "E-mail";
}

export function ConfiguracoesPage(): JSX.Element {
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabId>("gateway");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  const me = useQuery({ queryKey: ["portalMe"], queryFn: fetchPortalMe, staleTime: 60_000 });
  const isAdmin = me.data?.user.membership_role === "admin_escritorio";

  const configQ = useQuery({
    queryKey: ["escritorioConfig"],
    queryFn: fetchEscritorioConfig,
    enabled: isAdmin
  });

  const [razaoSocial, setRazaoSocial] = useState("");
  const [gatewayProvider, setGatewayProvider] = useState("");
  const [gatewayApiKey, setGatewayApiKey] = useState("");
  const [gatewayCredentials, setGatewayCredentials] = useState<Record<string, string>>({});
  const [whatsappProvider, setWhatsappProvider] = useState<"zapi" | "twilio" | "">("");
  const [whatsappToken, setWhatsappToken] = useState("");

  const providersQ = useQuery({
    queryKey: ["gatewayProviders"],
    queryFn: fetchGatewayProviders,
    enabled: isAdmin
  });

  const schemaQ = useQuery({
    queryKey: ["gatewaySchema", gatewayProvider],
    queryFn: () => fetchGatewayProviderSchema(gatewayProvider),
    enabled: isAdmin && Boolean(gatewayProvider)
  });

  const gatewayHistoryQ = useQuery({
    queryKey: ["gatewayHistory"],
    queryFn: fetchGatewayChangeHistory,
    enabled: isAdmin && tab === "gateway"
  });

  const selectedMeta: GatewayProviderMeta | undefined =
    providersQ.data?.data.find((p) => p.id === gatewayProvider) ?? schemaQ.data?.provider;

  useEffect(() => {
    const c = configQ.data?.config;
    if (!c) return;
    setRazaoSocial(c.razao_social ?? "");
    setGatewayProvider(c.gateway_provider ?? "");
    setGatewayApiKey("");
    setGatewayCredentials({});
    setWhatsappProvider((c.whatsapp_provider as "zapi" | "twilio") ?? "");
    setWhatsappToken(c.whatsapp_token ?? "");
  }, [configQ.data?.config]);

  const saveConfig = useMutation({
    mutationFn: (body: PatchEscritorioConfigBody) => patchEscritorioConfig(body),
    onSuccess: async () => {
      setSaveErr(null);
      setSaveMsg("Configurações guardadas.");
      await qc.invalidateQueries({ queryKey: ["escritorioConfig"] });
    },
    onError: (e: unknown) => {
      setSaveMsg(null);
      setSaveErr(e instanceof Error ? e.message : "Erro ao guardar");
    }
  });

  const saveGateway = useMutation({
    mutationFn: async () => {
      if (!gatewayProvider) throw new Error("Selecione um gateway.");
      const meta = selectedMeta;
      if (meta?.authType === "api_key") {
        const maskedKey = configQ.data?.config?.gateway_api_key;
        const apiKey = gatewayCredentials.api_key?.trim() || gatewayApiKey.trim();
        if (!shouldPatchSecret(apiKey, maskedKey) && !configQ.data?.config?.gateway_credentials_configured) {
          throw new Error("Informe a API key do gateway.");
        }
        return patchGatewayProvider({
          gateway_provider: gatewayProvider,
          ...(shouldPatchSecret(apiKey, maskedKey) ? { gateway_api_key: apiKey } : {}),
          ...(Object.keys(gatewayCredentials).length > 0
            ? { gateway_credentials: { api_key: apiKey, ...gatewayCredentials } }
            : {})
        });
      }
      const creds = { ...gatewayCredentials };
      const filled = Object.entries(creds).filter(([, v]) => v.trim());
      if (filled.length === 0 && !configQ.data?.config?.gateway_credentials_configured) {
        throw new Error("Preencha as credenciais do gateway.");
      }
      return patchGatewayProvider({
        gateway_provider: gatewayProvider,
        gateway_credentials: Object.fromEntries(filled.map(([k, v]) => [k, v.trim()]))
      });
    },
    onSuccess: async () => {
      setSaveErr(null);
      setSaveMsg("Configurações guardadas.");
      await qc.invalidateQueries({ queryKey: ["escritorioConfig"] });
      await qc.invalidateQueries({ queryKey: ["gatewayHistory"] });
    },
    onError: (e: unknown) => {
      setSaveMsg(null);
      setSaveErr(e instanceof Error ? e.message : "Erro ao guardar");
    }
  });

  function onSaveGateway(e: FormEvent): void {
    e.preventDefault();
    if (!isAdmin) return;
    setSaveMsg(null);
    setSaveErr(null);
    const maskedWa = configQ.data?.config?.whatsapp_token;
    const body: PatchEscritorioConfigBody = {};
    if (razaoSocial.trim()) body.razao_social = razaoSocial.trim();
    if (whatsappProvider) body.whatsapp_provider = whatsappProvider;
    if (shouldPatchSecret(whatsappToken, maskedWa)) body.whatsapp_token = whatsappToken.trim();

    const saveWhatsappOnly =
      !gatewayProvider &&
      (body.razao_social !== undefined ||
        body.whatsapp_provider !== undefined ||
        body.whatsapp_token !== undefined);

    if (saveWhatsappOnly && Object.keys(body).length > 0) {
      saveConfig.mutate(body);
      return;
    }
    saveGateway.mutate();
    if (Object.keys(body).length > 0) {
      saveConfig.mutate(body);
    }
  }

  const reguaQ = useQuery({
    queryKey: ["chargingRules"],
    queryFn: fetchChargingRules,
    enabled: isAdmin && tab === "regua"
  });

  const [daysOffset, setDaysOffset] = useState("0");
  const [reguaChannel, setReguaChannel] = useState<"email" | "whatsapp" | "both">("email");
  const [reguaErr, setReguaErr] = useState<string | null>(null);

  const addRegua = useMutation({
    mutationFn: () =>
      postChargingRule({
        days_offset: Number(daysOffset),
        channel: reguaChannel
      }),
    onSuccess: async () => {
      setReguaErr(null);
      await qc.invalidateQueries({ queryKey: ["chargingRules"] });
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 409) {
        setReguaErr("Regra duplicada para este offset e canal.");
        return;
      }
      setReguaErr(e instanceof Error ? e.message : "Erro ao criar regra");
    }
  });

  const toggleRegua = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => patchChargingRule(id, { is_active: active }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["chargingRules"] });
    }
  });

  const removeRegua = useMutation({
    mutationFn: (id: string) => deleteChargingRule(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["chargingRules"] });
    }
  });

  const templatesQ = useQuery({
    queryKey: ["notificationTemplates"],
    queryFn: fetchNotificationTemplates,
    enabled: isAdmin && tab === "templates"
  });

  const cobrancasQ = useQuery({
    queryKey: ["cobrancas", "configPreview"],
    queryFn: () => fetchCobrancas({ limit: 5 }),
    enabled: isAdmin && tab === "templates"
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [previewChargeId, setPreviewChargeId] = useState("");
  const [previewOut, setPreviewOut] = useState<string | null>(null);
  const [tplErr, setTplErr] = useState<string | null>(null);

  const saveTpl = useMutation({
    mutationFn: () => {
      if (!editId) throw new Error("template_id ausente");
      return patchNotificationTemplate(editId, {
        subject: editSubject || undefined,
        body_template: editBody
      });
    },
    onSuccess: async () => {
      setTplErr(null);
      setEditId(null);
      await qc.invalidateQueries({ queryKey: ["notificationTemplates"] });
    },
    onError: (e: unknown) => {
      if (e instanceof ApiError && e.status === 422) {
        setTplErr("Template de sistema não pode ser editado.");
        return;
      }
      setTplErr(e instanceof Error ? e.message : "Erro ao guardar template");
    }
  });

  const previewTpl = useMutation({
    mutationFn: () => {
      if (!editId || !previewChargeId.trim()) throw new Error("Selecione template e cobrança");
      return previewNotificationTemplate(editId, previewChargeId.trim());
    },
    onSuccess: (data) => {
      setTplErr(null);
      setPreviewOut(
        [data.subject ? `Assunto: ${data.subject}` : null, "", data.body_rendered].filter(Boolean).join("\n")
      );
    },
    onError: (e: unknown) => {
      setPreviewOut(null);
      setTplErr(e instanceof Error ? e.message : "Erro no preview");
    }
  });

  if (me.isLoading) {
    return <p className="muted">A carregar…</p>;
  }

  if (!isAdmin) {
    return (
      <div className="shell-page">
        <h2 className="shell-page__title">Configurações</h2>
        <div className="banner-warn">
          Apenas utilizadores com papel <strong>admin_escritorio</strong> podem alterar gateway, régua e templates.
          O seu papel: <code>{me.data?.user.membership_role ?? "—"}</code>.
        </div>
      </div>
    );
  }

  return (
    <div className="shell-page">
      <h2 className="shell-page__title">Configurações do escritório</h2>
      <p className="muted">Gateway de pagamento, régua de cobrança e templates de notificação.</p>

      <div className="proto-toolbar" style={{ marginTop: "1rem", marginBottom: "1rem" }}>
        {(
          [
            ["gateway", "Gateway e integrações"],
            ["regua", "Régua de cobrança"],
            ["templates", "Templates"]
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "btn-primary" : "btn-secondary"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "gateway" ? (
        <form className="form-card form-card--full" onSubmit={onSaveGateway}>
          <h3 className="form-card__title">Gateway e integrações</h3>
          {configQ.isLoading ? <p className="muted">A carregar…</p> : null}
          {configQ.isError ? (
            <div className="banner-err">{configQ.error instanceof Error ? configQ.error.message : "Erro"}</div>
          ) : null}
          <div className="form-grid">
            <label className="field-label">
              Razão social
              <input value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} />
            </label>
            <label className="field-label">
              Gateway
              <select
                value={gatewayProvider}
                onChange={(e) => {
                  setGatewayProvider(e.target.value);
                  setGatewayCredentials({});
                  setGatewayApiKey("");
                }}
              >
                <option value="">—</option>
                {(providersQ.data?.data ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </label>
            {selectedMeta?.authType === "api_key" ? (
              <label className="field-label">
                API key
                <input
                  type="password"
                  value={gatewayCredentials.api_key ?? gatewayApiKey}
                  placeholder={
                    configQ.data?.config?.gateway_api_key
                      ? "Deixe em branco para manter"
                      : "Mín. 10 caracteres"
                  }
                  onChange={(e) =>
                    setGatewayCredentials((prev) => ({ ...prev, api_key: e.target.value }))
                  }
                />
                {configQ.data?.config?.gateway_api_key ? (
                  <span className="muted small">Atual: {configQ.data.config.gateway_api_key}</span>
                ) : null}
              </label>
            ) : null}
            {(selectedMeta?.credentialFields ?? [])
              .filter((f) => f.key !== "api_key")
              .map((field) => (
                <label key={field.key} className="field-label">
                  {field.label}
                  {field.secret && (field.key.includes("pem") || field.key.includes("certificate")) ? (
                    <textarea
                      rows={4}
                      value={gatewayCredentials[field.key] ?? ""}
                      placeholder={
                        configQ.data?.config?.gateway_credentials_configured
                          ? "Deixe em branco para manter"
                          : field.required
                            ? "Obrigatório"
                            : ""
                      }
                      onChange={(e) =>
                        setGatewayCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  ) : (
                    <input
                      type={field.secret ? "password" : "text"}
                      value={gatewayCredentials[field.key] ?? ""}
                      placeholder={
                        configQ.data?.config?.gateway_credentials_configured
                          ? "Deixe em branco para manter"
                          : ""
                      }
                      onChange={(e) =>
                        setGatewayCredentials((prev) => ({ ...prev, [field.key]: e.target.value }))
                      }
                    />
                  )}
                </label>
              ))}
            {configQ.data?.config?.gateway_credentials_configured ? (
              <p className="muted small">Credenciais já configuradas (valores mascarados no servidor).</p>
            ) : null}
            {gatewayHistoryQ.data?.data.length ? (
              <div className="muted small" style={{ gridColumn: "1 / -1" }}>
                <strong>Últimas trocas de gateway</strong>
                <ul>
                  {gatewayHistoryQ.data.data.map((h) => (
                    <li key={h.id}>
                      {h.old_provider ?? "—"} → {h.new_provider} ({new Date(h.changed_at).toLocaleString()})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <label className="field-label">
              WhatsApp (provedor)
              <select
                value={whatsappProvider}
                onChange={(e) => setWhatsappProvider(e.target.value as "zapi" | "twilio" | "")}
              >
                <option value="">—</option>
                <option value="zapi">Z-API</option>
                <option value="twilio">Twilio</option>
              </select>
            </label>
            <label className="field-label">
              Token WhatsApp
              <input
                type="password"
                value={whatsappToken}
                onChange={(e) => setWhatsappToken(e.target.value)}
                placeholder={configQ.data?.config?.whatsapp_token ? "Deixe em branco para manter" : ""}
              />
            </label>
          </div>
          {saveMsg ? <div className="banner-ok">{saveMsg}</div> : null}
          {saveErr ? <div className="banner-err">{saveErr}</div> : null}
          <p style={{ marginTop: "1rem" }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={saveConfig.isPending || saveGateway.isPending}
            >
              {saveConfig.isPending || saveGateway.isPending ? "A guardar…" : "Guardar configurações"}
            </button>
          </p>
        </form>
      ) : null}

      {tab === "regua" ? (
        <div className="form-card form-card--full">
          <h3 className="form-card__title">Régua de cobrança</h3>
          <form
            className="proto-toolbar"
            onSubmit={(e) => {
              e.preventDefault();
              setReguaErr(null);
              addRegua.mutate();
            }}
          >
            <div className="proto-toolbar__field">
              <span className="field-label">Dias (offset)</span>
              <input
                type="number"
                min={-30}
                max={30}
                value={daysOffset}
                onChange={(e) => setDaysOffset(e.target.value)}
              />
            </div>
            <div className="proto-toolbar__field">
              <span className="field-label">Canal</span>
              <select value={reguaChannel} onChange={(e) => setReguaChannel(e.target.value as typeof reguaChannel)}>
                <option value="email">E-mail</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="both">Ambos</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={addRegua.isPending}>
              Adicionar regra
            </button>
          </form>
          {reguaErr ? <div className="banner-err">{reguaErr}</div> : null}
          {reguaQ.isLoading ? <p className="muted">A carregar regras…</p> : null}
          <div className="table-wrap" style={{ marginTop: "1rem" }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Offset (dias)</th>
                  <th>Canal</th>
                  <th>Evento</th>
                  <th>Ativa</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {(reguaQ.data?.data ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="muted">
                      Nenhuma regra configurada.
                    </td>
                  </tr>
                ) : (
                  reguaQ.data?.data.map((r) => (
                    <tr key={r.id}>
                      <td>{r.days_offset}</td>
                      <td>{channelLabel(r.channel)}</td>
                      <td className="muted small">{r.event_type ?? "—"}</td>
                      <td>{r.is_active ? "Sim" : "Não"}</td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="link-inline"
                            onClick={() => toggleRegua.mutate({ id: r.id, active: !r.is_active })}
                          >
                            {r.is_active ? "Desativar" : "Ativar"}
                          </button>
                          <span className="sep">|</span>
                          <button
                            type="button"
                            className="link-inline"
                            onClick={() => {
                              if (window.confirm("Remover esta regra?")) {
                                removeRegua.mutate(r.id);
                              }
                            }}
                          >
                            Remover
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "templates" ? (
        <div className="form-card form-card--full">
          <h3 className="form-card__title">Templates de notificação</h3>
          {templatesQ.isLoading ? <p className="muted">A carregar…</p> : null}
          {tplErr ? <div className="banner-err">{tplErr}</div> : null}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Evento</th>
                  <th>Canal</th>
                  <th>Tenant</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {(templatesQ.data?.data ?? []).map((t) => (
                  <tr key={t.id}>
                    <td>
                      <code>{t.event_type}</code>
                    </td>
                    <td>{t.channel}</td>
                    <td>{t.tenant_id ? "Escritório" : "Sistema"}</td>
                    <td>
                      <button
                        type="button"
                        className="link-inline"
                        disabled={!t.tenant_id}
                        title={!t.tenant_id ? "Templates de sistema são só leitura" : undefined}
                        onClick={() => {
                          setEditId(t.id);
                          setEditSubject(t.subject ?? "");
                          setEditBody(t.body_template);
                          setPreviewOut(null);
                          setTplErr(null);
                          const first = cobrancasQ.data?.data?.[0];
                          if (first?.id) setPreviewChargeId(first.id);
                        }}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {editId ? (
            <div style={{ marginTop: "1.5rem" }}>
              <h4 className="form-card__title">Editar template</h4>
              <label className="field-label">
                Assunto
                <input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} />
              </label>
              <label className="field-label" style={{ display: "block", marginTop: "0.75rem" }}>
                Corpo (placeholders: {"{{nome}}"}, {"{{valor}}"}, …)
                <textarea
                  rows={6}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  style={{ width: "100%", marginTop: "0.35rem" }}
                />
              </label>
              <label className="field-label" style={{ display: "block", marginTop: "0.75rem" }}>
                Cobrança para preview (UUID)
                <input value={previewChargeId} onChange={(e) => setPreviewChargeId(e.target.value)} />
              </label>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                <button type="button" className="btn-primary" disabled={saveTpl.isPending} onClick={() => saveTpl.mutate()}>
                  Guardar template
                </button>
                <button type="button" className="btn-secondary" disabled={previewTpl.isPending} onClick={() => previewTpl.mutate()}>
                  Preview
                </button>
                <button type="button" className="btn-secondary" onClick={() => setEditId(null)}>
                  Cancelar
                </button>
              </div>
              {previewOut ? (
                <pre className="form-card" style={{ marginTop: "1rem", whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>
                  {previewOut}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
