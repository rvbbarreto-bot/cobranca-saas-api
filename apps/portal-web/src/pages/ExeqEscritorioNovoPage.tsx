import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  createEscritorio,
  PORTAL_MODULE_LABELS,
  slugifyEscritorioName,
  type PortalModuleFlags,
  type PortalModuleKey
} from "../lib/exeq-api";

const MODULE_KEYS = Object.keys(PORTAL_MODULE_LABELS) as PortalModuleKey[];

const DEFAULT_MODULES: PortalModuleFlags = {
  cobranca: true,
  clientes: true,
  notas_fiscais: true,
  fiscal_guias: true,
  relatorios: true
};

export function ExeqEscritorioNovoPage(): JSX.Element {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [modules, setModules] = useState<PortalModuleFlags>({ ...DEFAULT_MODULES });
  const [error, setError] = useState<string | null>(null);

  const suggestedSlug = useMemo(() => slugifyEscritorioName(name), [name]);
  const effectiveSlug = slugTouched ? slug : suggestedSlug;

  const mutation = useMutation({
    mutationFn: () =>
      createEscritorio({
        slug: effectiveSlug,
        name: name.trim(),
        status: "active",
        modules,
        admin: {
          email: adminEmail.trim(),
          full_name: adminName.trim(),
          password: adminPassword,
          role: "admin_escritorio"
        }
      }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["exeqEscritorios"] });
      const id =
        typeof res === "object" &&
        res !== null &&
        "escritorio" in res &&
        typeof (res as { escritorio: { automacao_tenant_id?: string } }).escritorio.automacao_tenant_id === "string"
          ? (res as { escritorio: { automacao_tenant_id: string } }).escritorio.automacao_tenant_id
          : null;
      navigate(id ? `/exeq/escritorios/${encodeURIComponent(id)}` : "/exeq/escritorios", { replace: true });
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : "Falha ao criar escritório");
    }
  });

  function toggleModule(key: PortalModuleKey): void {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !effectiveSlug || !adminEmail.trim() || !adminName.trim() || adminPassword.length < 8) {
      setError("Preencha nome, slug, admin e senha (mín. 8 caracteres).");
      return;
    }
    mutation.mutate();
  }

  return (
    <div className="exeq-page exeq-page--narrow">
      <div className="exeq-page__header">
        <div>
          <Link to="/exeq/escritorios" className="exeq-back-link">
            ← Escritórios
          </Link>
          <h2 className="exeq-page__title">Novo escritório</h2>
          <p className="exeq-page__subtitle">
            Provisiona tenant automação + billing, módulos do portal e o primeiro administrador (acesso total).
          </p>
        </div>
      </div>

      <form className="exeq-form-card stack" onSubmit={(e) => void onSubmit(e)}>
        <section>
          <h3 className="exeq-form-section__title">Identificação</h3>
          <label>
            Nome do escritório
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Escritório Atibaia" />
          </label>
          <label>
            Slug (tenant_id no login)
            <input
              value={slugTouched ? slug : suggestedSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              placeholder="escritorio-atibaia"
            />
            <span className="muted small">Usado no login do portal: tenant_id = slug</span>
          </label>
        </section>

        <section>
          <h3 className="exeq-form-section__title">Módulos contratados</h3>
          <div className="exeq-module-grid">
            {MODULE_KEYS.map((key) => (
              <label key={key} className="exeq-module-toggle">
                <input type="checkbox" checked={modules[key]} onChange={() => toggleModule(key)} />
                <span>{PORTAL_MODULE_LABELS[key]}</span>
              </label>
            ))}
          </div>
        </section>

        <section>
          <h3 className="exeq-form-section__title">Administrador inicial</h3>
          <label>
            Nome
            <input value={adminName} onChange={(e) => setAdminName(e.target.value)} />
          </label>
          <label>
            E-mail
            <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
          </label>
          <label>
            Senha inicial
            <input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
          </label>
          <p className="muted small">Papel: admin_escritorio (acesso total dentro do escritório).</p>
        </section>

        {error ? (
          <p className="err" role="alert">
            {error}
          </p>
        ) : null}

        <div className="exeq-form-actions">
          <Link to="/exeq/escritorios" className="btn btn--ghost">
            Cancelar
          </Link>
          <button type="submit" className="btn btn--primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Provisionando…" : "Criar escritório"}
          </button>
        </div>
      </form>
    </div>
  );
}
