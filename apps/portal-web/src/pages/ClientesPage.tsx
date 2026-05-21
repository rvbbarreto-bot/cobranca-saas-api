import { useMemo, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { PortalLoadMore } from "../components/PortalLoadMore";
import { fetchClientes, fetchCobrancas } from "../lib/api";
import type { ChargeRow, ClienteRow } from "../lib/api";
import {
  chargeStatusLabelPortal,
  portalClienteIdFromMetadata
} from "../lib/charge-status-ui";

function formatDocBR(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) {
    return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

function formatDueShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

type RowView = ClienteRow & {
  mensalidade: string | null;
  vencimentoDia: string | null;
  ultimoBoleto: string | null;
  statusPill: "ativo" | "cobranca" | "atencao" | "programado";
  statusLabel: string;
};

function buildRowViews(clientes: ClienteRow[], charges: ChargeRow[]): RowView[] {
  const byCliente: Record<string, ChargeRow[]> = {};
  for (const ch of charges) {
    const pid = portalClienteIdFromMetadata(ch);
    if (!pid) {
      continue;
    }
    if (!byCliente[pid]) {
      byCliente[pid] = [];
    }
    byCliente[pid].push(ch);
  }

  return clientes.map((c) => {
    const list = byCliente[c.id] ?? [];
    const mensalidade: string | null = null;
    const vencimentoDia: string | null = null;

    let ultimoBoleto: string | null = null;
    let statusPill: RowView["statusPill"] = "ativo";
    let statusLabel = "Ativo";

    if (list.length > 0) {
      const sorted = [...list].sort((a, b) => b.dueDate.localeCompare(a.dueDate));
      const top = sorted[0];
      if (top) {
        ultimoBoleto = `${chargeStatusLabelPortal(top.canonicalStatus)} ${formatDueShort(top.dueDate)}`;
        if (top.canonicalStatus === "vencida") {
          statusPill = "cobranca";
          statusLabel = "Cobrança";
        } else if (top.canonicalStatus === "erro_emissao") {
          statusPill = "atencao";
          statusLabel = "Atenção";
        } else if (top.canonicalStatus === "rascunho") {
          statusPill = "programado";
          statusLabel = "Programado";
        } else if (top.canonicalStatus === "cancelada") {
          statusPill = "ativo";
          statusLabel = "Ativo";
        }
      }
    }

    return {
      ...c,
      mensalidade,
      vencimentoDia,
      ultimoBoleto,
      statusPill,
      statusLabel
    };
  });
}

const CLIENTES_PAGE_SIZE = 50;

export function ClientesPage(): JSX.Element {
  const q = useInfiniteQuery({
    queryKey: ["clientes"],
    queryFn: ({ pageParam }) =>
      fetchClientes({
        limit: CLIENTES_PAGE_SIZE,
        cursor: pageParam as string | undefined
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined
  });
  const cobQ = useQuery({
    queryKey: ["cobrancas", "forClientes"],
    queryFn: () => fetchCobrancas({ limit: 200 })
  });

  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState<"todos" | "ativo" | "cobranca" | "atencao" | "programado">("todos");

  const allClientes = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data?.pages]);

  const rows = useMemo(() => {
    const data = allClientes;
    const charges = cobQ.data?.data ?? [];
    const enriched = buildRowViews(data, charges);
    return enriched.filter((r) => {
      const qn = busca.trim().toLowerCase();
      if (qn) {
        const hit =
          r.nome.toLowerCase().includes(qn) ||
          r.documento.replace(/\D/g, "").includes(qn.replace(/\D/g, ""));
        if (!hit) {
          return false;
        }
      }
      if (statusFiltro === "todos") {
        return true;
      }
      return r.statusPill === statusFiltro;
    });
  }, [allClientes, cobQ.data?.data, busca, statusFiltro]);

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <div>
          <h2 className="shell-page__title">Clientes</h2>
          <p className="shell-page__desc" style={{ marginBottom: 0 }}>
            Cadastro do escritório com visão operacional. Colunas de mensalidade e vencimento aparecem quando a API
            passar a expor os campos; até lá usamos dados derivados das cobranças vinculadas.
          </p>
        </div>
        <Link to="/clientes/novo" className="btn-primary">
          Novo cliente
        </Link>
      </div>

      {q.isLoading ? <p className="muted">Carregando…</p> : null}
      {q.isError ? (
        <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro ao carregar"}</div>
      ) : null}
      {cobQ.isError ? (
        <div className="banner-warn">
          Não foi possível carregar boletos para enriquecer a lista ({cobQ.error instanceof Error ? cobQ.error.message : "erro"}).
        </div>
      ) : null}

      {q.data && !q.isLoading && !q.isError ? (
        <>
          <div className="proto-toolbar">
            <div className="proto-toolbar__field" style={{ flex: "1 1 200px", minWidth: "200px" }}>
              <span className="field-label">Buscar</span>
              <input
                type="search"
                placeholder="Buscar por nome / documento"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                aria-label="Buscar por nome ou documento"
              />
            </div>
            <div className="proto-toolbar__field">
              <span className="field-label">Status</span>
              <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value as typeof statusFiltro)}>
                <option value="todos">Todos</option>
                <option value="ativo">Ativo</option>
                <option value="cobranca">Cobrança</option>
                <option value="atencao">Atenção</option>
                <option value="programado">Programado</option>
              </select>
            </div>
            <div className="proto-toolbar__field">
              <span className="field-label">Perfil de cobrança</span>
              <select disabled title="Em roadmap">
                <option>Todos</option>
              </select>
            </div>
            <div className="proto-toolbar__field">
              <span className="field-label">Vencimento</span>
              <select disabled title="Em roadmap">
                <option>Qualquer</option>
              </select>
            </div>
            <div className="proto-toolbar__field">
              <span className="field-label">Banco emissor</span>
              <select disabled title="Em roadmap">
                <option>Todos</option>
              </select>
            </div>
          </div>

          <div className="table-wrap">
            {allClientes.length === 0 && !q.hasNextPage ? (
              <p className="muted padded">Nenhum cliente cadastrado. Clique em &quot;Novo cliente&quot;.</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Documento</th>
                    <th>Mensalidade</th>
                    <th>Vencimento</th>
                    <th>Último boleto</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="muted">
                        Nenhum cliente corresponde aos filtros.
                      </td>
                    </tr>
                  ) : (
                    rows.map((c) => (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600 }}>{c.nome}</td>
                        <td style={{ fontVariantNumeric: "tabular-nums" }}>{formatDocBR(c.documento)}</td>
                        <td>{c.mensalidade ?? "—"}</td>
                        <td>{c.vencimentoDia ?? "—"}</td>
                        <td>{c.ultimoBoleto ?? "—"}</td>
                        <td>
                          <span className={`status-pill status-pill--${c.statusPill}`}>{c.statusLabel}</span>
                        </td>
                        <td>
                          <div className="table-actions">
                            <Link to={`/clientes/${c.id}`} className="link-inline">
                              Ver
                            </Link>
                            <span className="sep">|</span>
                            <Link to={`/clientes/${c.id}/editar`} className="link-inline">
                              Editar
                            </Link>
                            <span className="sep">|</span>
                            <Link to={`/cobrancas/nova?clienteId=${encodeURIComponent(c.id)}`} className="link-inline">
                              Cobrar
                            </Link>
                            <span className="sep">|</span>
                            <span
                              className="link-inline"
                              style={{ opacity: 0.45, cursor: "not-allowed" }}
                              title="Em roadmap"
                            >
                              Reprocessar
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
          <PortalLoadMore
            hasMore={Boolean(q.hasNextPage)}
            loading={q.isFetchingNextPage}
            onLoadMore={() => void q.fetchNextPage()}
            loadedCount={allClientes.length}
          />
          {rows.length !== allClientes.length ? (
            <p className="muted small" style={{ marginTop: "0.35rem" }}>
              Filtro local: {rows.length} de {allClientes.length} carregados
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
