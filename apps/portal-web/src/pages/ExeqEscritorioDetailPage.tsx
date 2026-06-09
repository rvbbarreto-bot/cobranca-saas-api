import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ExeqModuleEditor } from "../components/exeq/ExeqModuleEditor";
import { ExeqStatusBadge } from "../components/exeq/ExeqStatusBadge";
import {
  addEscritorioAccess,
  fetchEscritorioDetail,
  patchEscritorio,
  type PortalModuleFlags
} from "../lib/exeq-api";

export function ExeqEscritorioDetailPage(): JSX.Element {
  const { escritorioId = "" } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["exeqEscritorio", escritorioId],
    queryFn: () => fetchEscritorioDetail(escritorioId),
    enabled: Boolean(escritorioId)
  });

  const primaryAdmin = useMemo(
    () => (q.data?.memberships ?? []).find((m) => m.role === "admin_escritorio") ?? null,
    [q.data?.memberships]
  );

  const [name, setName] = useState("");
  const [active, setActive] = useState(true);
  const [modules, setModules] = useState<PortalModuleFlags | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState<string | null>(null);

  const [accessEmail, setAccessEmail] = useState("");
  const [accessName, setAccessName] = useState("");
  const [accessPassword, setAccessPassword] = useState("");
  const [accessRole, setAccessRole] = useState<"admin_escritorio" | "operador">("operador");

  useEffect(() => {
    const esc = q.data?.escritorio;
    if (!esc) return;
    setName(esc.name ?? "");
    setActive(esc.active);
    setModules(esc.modules);
  }, [q.data?.escritorio]);

  useEffect(() => {
    if (!primaryAdmin) return;
    setAdminEmail(primaryAdmin.email);
    setAdminName(primaryAdmin.fullName ?? "");
  }, [primaryAdmin]);

  const saveEscritorio = useMutation({
    mutationFn: async () => {
      if (!modules || !primaryAdmin) {
        throw new Error("Dados incompletos para salvar.");
      }
      const body: Parameters<typeof patchEscritorio>[1] = {
        name: name.trim(),
        active,
        modules,
        primary_admin: {
          app_user_id: primaryAdmin.appUserId,
          email: adminEmail.trim(),
          full_name: adminName.trim()
        }
      };
      if (adminPassword.trim().length >= 8) {
        body.primary_admin!.password = adminPassword;
      }
      return patchEscritorio(escritorioId, body);
    },
    onSuccess: async () => {
      setFormOk("Escritório atualizado com sucesso.");
      setFormError(null);
      setAdminPassword("");
      await qc.invalidateQueries({ queryKey: ["exeqEscritorio", escritorioId] });
      await qc.invalidateQueries({ queryKey: ["exeqEscritorios"] });
    },
    onError: (e: unknown) => {
      setFormError(e instanceof Error ? e.message : "Erro ao salvar");
      setFormOk(null);
    }
  });

  const addAccess = useMutation({
    mutationFn: () =>
      addEscritorioAccess(escritorioId, {
        email: accessEmail.trim(),
        full_name: accessName.trim(),
        password: accessPassword,
        role: accessRole
      }),
    onSuccess: async () => {
      setFormOk(`Acesso criado para ${accessEmail.trim()}.`);
      setAccessEmail("");
      setAccessName("");
      setAccessPassword("");
      await qc.invalidateQueries({ queryKey: ["exeqEscritorio", escritorioId] });
    },
    onError: (e: unknown) => {
      setFormError(e instanceof Error ? e.message : "Erro ao criar acesso");
      setFormOk(null);
    }
  });

  function onSave(e: FormEvent): void {
    e.preventDefault();
    setFormError(null);
    setFormOk(null);
    if (!name.trim()) {
      setFormError("Informe o nome do escritório.");
      return;
    }
    if (!adminEmail.trim() || !adminName.trim()) {
      setFormError("Informe e-mail e nome do administrador principal.");
      return;
    }
    saveEscritorio.mutate();
  }

  function onToggleActive(): void {
    if (active) {
      const ok = window.confirm(
        "Inativar este escritório? Usuários não poderão fazer login e sessões abertas serão encerradas."
      );
      if (!ok) return;
      setActive(false);
      return;
    }
    setActive(true);
  }

  function onAddAccessSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!accessEmail.trim() || !accessName.trim() || accessPassword.length < 8) {
      setFormError("Preencha e-mail, nome e senha (mín. 8) do novo usuário.");
      return;
    }
    addAccess.mutate();
  }

  const esc = q.data?.escritorio;

  return (
    <div className="exeq-page">
      <Link to="/exeq/escritorios" className="exeq-back-link">
        ← Voltar aos escritórios
      </Link>

      {q.isLoading ? <div className="exeq-loading">Carregando…</div> : null}
      {q.isError ? (
        <div className="exeq-alert exeq-alert--error" role="alert">
          {q.error instanceof Error ? q.error.message : "Erro"}
        </div>
      ) : null}

      {esc && modules ? (
        <>
          <div className="exeq-page__header exeq-page__header--detail">
            <div>
              <div className="exeq-title-row">
                <h2 className="exeq-page__title">{esc.name ?? "Escritório"}</h2>
                <ExeqStatusBadge active={esc.active} billingStatus={esc.publicTenantStatus} />
              </div>
              <p className="exeq-page__subtitle">
                Tenant <code className="exeq-code">{esc.slug ?? esc.automacaoTenantId}</code>
                {esc.publicTenantSlug ? (
                  <>
                    {" "}
                    · Billing <code className="exeq-code">{esc.publicTenantSlug}</code>
                  </>
                ) : null}
              </p>
            </div>
          </div>

          {formOk ? <div className="exeq-alert exeq-alert--ok">{formOk}</div> : null}
          {formError ? (
            <div className="exeq-alert exeq-alert--error" role="alert">
              {formError}
            </div>
          ) : null}

          <form className="exeq-detail-layout" onSubmit={onSave}>
            <section className="exeq-card exeq-form-section">
              <h3 className="exeq-section-title">Dados do escritório</h3>
              <label className="exeq-field">
                <span>Nome</span>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <div className="exeq-field">
                <span>Status operacional</span>
                <div className="exeq-toggle-row">
                  <button
                    type="button"
                    className={`exeq-toggle-btn${active ? " exeq-toggle-btn--on" : ""}`}
                    onClick={() => setActive(true)}
                  >
                    Ativo
                  </button>
                  <button
                    type="button"
                    className={`exeq-toggle-btn${!active ? " exeq-toggle-btn--off" : ""}`}
                    onClick={onToggleActive}
                  >
                    Inativo
                  </button>
                </div>
                <p className="exeq-field-hint">
                  Escritórios inativos bloqueiam login e encerram sessões em andamento.
                </p>
              </div>
            </section>

            <section className="exeq-card exeq-form-section">
              <h3 className="exeq-section-title">Administrador principal</h3>
              {primaryAdmin ? (
                <>
                  <label className="exeq-field">
                    <span>Nome</span>
                    <input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
                  </label>
                  <label className="exeq-field">
                    <span>E-mail</span>
                    <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                  </label>
                  <label className="exeq-field">
                    <span>Nova senha</span>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Deixe vazio para manter a atual"
                    />
                  </label>
                </>
              ) : (
                <p className="exeq-field-hint">Nenhum admin cadastrado. Adicione abaixo.</p>
              )}
            </section>

            <section className="exeq-card exeq-form-section exeq-form-section--wide">
              <h3 className="exeq-section-title">Módulos contratados</h3>
              <ExeqModuleEditor modules={modules} onChange={setModules} />
            </section>

            <div className="exeq-form-actions exeq-form-actions--sticky">
              <button
                type="button"
                className="exeq-btn exeq-btn--ghost"
                onClick={() => navigate("/exeq/escritorios")}
              >
                Cancelar
              </button>
              <button type="submit" className="exeq-btn exeq-btn--primary" disabled={saveEscritorio.isPending}>
                {saveEscritorio.isPending ? "Salvando…" : "Salvar alterações"}
              </button>
            </div>
          </form>

          <section className="exeq-card exeq-form-section">
            <h3 className="exeq-section-title">Outros usuários</h3>
            <div className="exeq-user-list">
              {(q.data?.memberships ?? []).map((m) => (
                <div key={m.membershipId} className="exeq-user-row">
                  <div>
                    <div className="exeq-cell-title">{m.fullName ?? m.email}</div>
                    <div className="exeq-meta-inline">{m.email}</div>
                  </div>
                  <span className={`exeq-pill exeq-pill--role-${m.role}`}>
                    {m.role === "admin_escritorio" ? "Admin" : "Operador"}
                  </span>
                </div>
              ))}
            </div>

            <h4 className="exeq-section-subtitle">Adicionar usuário</h4>
            <form className="exeq-inline-form" onSubmit={onAddAccessSubmit}>
              <label className="exeq-field">
                <span>Nome</span>
                <input value={accessName} onChange={(e) => setAccessName(e.target.value)} />
              </label>
              <label className="exeq-field">
                <span>E-mail</span>
                <input type="email" value={accessEmail} onChange={(e) => setAccessEmail(e.target.value)} />
              </label>
              <label className="exeq-field">
                <span>Senha</span>
                <input type="password" value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} />
              </label>
              <label className="exeq-field">
                <span>Papel</span>
                <select value={accessRole} onChange={(e) => setAccessRole(e.target.value as typeof accessRole)}>
                  <option value="operador">Operador</option>
                  <option value="admin_escritorio">Admin total</option>
                </select>
              </label>
              <button type="submit" className="exeq-btn exeq-btn--secondary" disabled={addAccess.isPending}>
                {addAccess.isPending ? "Adicionando…" : "Adicionar"}
              </button>
            </form>
          </section>
        </>
      ) : null}
    </div>
  );
}
