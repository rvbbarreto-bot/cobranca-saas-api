import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { PortalLoadMore } from "../components/PortalLoadMore";
import { ReprocessEmissionButton } from "../components/ReprocessEmissionButton";
import { fetchCobrancas } from "../lib/api";
import type { ChargeRow } from "../lib/api";
import {
  bankLabel,
  chargeClienteNome,
  chargeStatusLabelPortal,
  chargeStatusPillClass,
  competenciaFromDue,
  isChargeEditable,
  nossoNumeroDisplay
} from "../lib/charge-status-ui";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatMoney(amount: string): string {
  const n = Number(amount);
  if (Number.isNaN(n)) {
    return amount;
  }
  return money.format(n);
}

function formatDueShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return "—";
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Todos os status" },
  { value: "rascunho", label: "Agendado" },
  { value: "emitida", label: "Emitido" },
  { value: "enviada", label: "Enviado" },
  { value: "pendente_pagamento", label: "Pendente" },
  { value: "paga", label: "Pago" },
  { value: "vencida", label: "Vencido" },
  { value: "cancelada", label: "Cancelado" },
  { value: "erro_emissao", label: "Falha" }
];

function BoletoActions({ row }: { row: ChargeRow }): JSX.Element {
  const s = row.canonicalStatus;
  const detail = (
    <Link to={`/cobrancas/${row.id}`} state={{ charge: row }} className="link-inline">
      Ver
    </Link>
  );
  const editar = isChargeEditable(s) ? (
    <Link to={`/cobrancas/${row.id}/editar`} className="link-inline">
      Editar
    </Link>
  ) : null;
  const pdfEligible =
    s === "emitida" || s === "enviada" || s === "pendente_pagamento" || s === "paga" || s === "vencida";
  const pdf = pdfEligible ? (
    <Link to={`/cobrancas/${row.id}#pagamento`} className="link-inline" title="Abrir pagamento e PDF">
      Ver PDF
    </Link>
  ) : (
    <span className="link-inline" style={{ opacity: 0.45, cursor: "not-allowed" }} title="Disponivel apos emissao">
      Ver PDF
    </span>
  );
  const enviar = (
    <Link to={`/cobrancas/${row.id}#enviar`} className="link-inline" title="Compartilhar com o cliente">
      Enviar
    </Link>
  );
  const cobrar = (
    <Link
      to={`/cobrancas/${row.id}#enviar`}
      className="link-inline"
      title="Reenviar cobrança vencida ao cliente"
    >
      Cobrar
    </Link>
  );
  const reprocessar = <ReprocessEmissionButton chargeId={row.id} />;
  const historico = (
    <Link to={`/cobrancas/${row.id}#timeline`} className="link-inline" title="Linha do tempo do boleto">
      Histórico
    </Link>
  );

  let extra: JSX.Element[] = [];
  if (s === "paga") {
    extra = [pdf, historico];
  } else if (s === "emitida" || s === "enviada") {
    extra = [pdf, enviar];
  } else if (s === "vencida") {
    extra = [cobrar];
  } else if (s === "erro_emissao") {
    extra = [reprocessar];
  } else if (s === "cancelada") {
    extra = [historico];
  } else {
    extra = [enviar];
  }

  return (
    <div className="table-actions">
      {detail}
      {editar ? (
        <>
          <span className="sep">|</span>
          {editar}
        </>
      ) : null}
      {extra.map((el, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
          <span className="sep">|</span>
          {el}
        </span>
      ))}
    </div>
  );
}

const COBRANCAS_PAGE_SIZE = 50;

export function CobrancasPage(): JSX.Element {
  const q = useInfiniteQuery({
    queryKey: ["cobrancas"],
    queryFn: ({ pageParam }) =>
      fetchCobrancas({
        limit: COBRANCAS_PAGE_SIZE,
        cursor: pageParam as string | undefined
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined
  });
  const [statusFilter, setStatusFilter] = useState("");

  const allRows = useMemo(() => q.data?.pages.flatMap((p) => p.data) ?? [], [q.data?.pages]);
  const billingMeta = q.data?.pages[0];

  const rows = useMemo(() => {
    if (!statusFilter) {
      return allRows;
    }
    return allRows.filter((r: ChargeRow) => r.canonicalStatus === statusFilter);
  }, [allRows, statusFilter]);

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <div>
          <h2 className="shell-page__title">Boletos</h2>
          <p className="shell-page__desc" style={{ marginBottom: 0 }}>
            Consulta, reenvio, cancelamento e rastreabilidade do ciclo financeiro.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <Link to="/cobrancas/nova" className="btn-primary">
            Nova cobrança
          </Link>
          <Link to="/relatorios" className="btn-secondary">
            Relatórios / CSV
          </Link>
        </div>
      </div>

      {q.isLoading ? <p className="muted">Carregando…</p> : null}
      {q.isError ? (
        <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro ao carregar"}</div>
      ) : null}
      {billingMeta?.billing_link_status === "missing" && billingMeta.message ? (
        <div className="banner-warn">{billingMeta.message}</div>
      ) : null}

      {billingMeta && !q.isLoading && billingMeta.billing_link_status !== "missing" ? (
        <>
          <div className="proto-toolbar">
            <div className="proto-toolbar__field" style={{ flex: "1 1 220px", maxWidth: "320px" }}>
              <span className="field-label">Filtrar por status</span>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status do boleto">
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value || "all"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="muted small" style={{ margin: 0, alignSelf: "center" }}>
              A mostrar {rows.length}
              {statusFilter ? ` (filtro local)` : ""} — {allRows.length} carregada{allRows.length === 1 ? "" : "s"}
            </p>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nosso nº</th>
                  <th>Cliente</th>
                  <th>Competência</th>
                  <th>Valor</th>
                  <th>Venc.</th>
                  <th>Banco</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="muted">
                      Nenhum boleto neste filtro.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id}>
                      <td style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{nossoNumeroDisplay(row)}</td>
                      <td>{chargeClienteNome(row)}</td>
                      <td>{competenciaFromDue(row.dueDate)}</td>
                      <td>{formatMoney(row.amount)}</td>
                      <td>{formatDueShort(row.dueDate)}</td>
                      <td>{bankLabel(row)}</td>
                      <td>
                        <span className={chargeStatusPillClass(row.canonicalStatus)}>
                          {chargeStatusLabelPortal(row.canonicalStatus)}
                        </span>
                      </td>
                      <td>
                        <BoletoActions row={row} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <PortalLoadMore
            hasMore={Boolean(q.hasNextPage)}
            loading={q.isFetchingNextPage}
            onLoadMore={() => void q.fetchNextPage()}
            loadedCount={allRows.length}
          />
        </>
      ) : null}
    </div>
  );
}
