import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import type { ChargeRow } from "../lib/api";
import { fetchPortalCobrancaDetail } from "../lib/api";
import { CHARGE_DETAIL_POLL_MS, shouldPollChargeDetail } from "../lib/charge-detail-poll";
import { ChargePaymentPanel } from "../components/ChargePaymentPanel";
import {
  bankLabel,
  chargeClienteNome,
  chargeStatusLabelPortal,
  chargeStatusPillClass,
  competenciaFromDue,
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

function formatDueFull(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type TlKind = "info" | "teal" | "ok";

type TlItem = { time: string; text: string; kind: TlKind };

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function buildTimeline(row: ChargeRow): TlItem[] {
  const p = row.dueDate.split("-").map(Number);
  const y = p[0] ?? 2026;
  const mo = (p[1] ?? 1) - 1;
  const day = p[2] ?? 1;
  const base = new Date(y, mo, day, 8, 1, 0, 0);
  const t = (mins: number): Date => new Date(base.getTime() + mins * 60_000);
  const fmt = (d: Date): string => `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

  const items: TlItem[] = [
    { time: fmt(t(0)), text: "Boleto criado no portal", kind: "info" },
    { time: fmt(t(1)), text: "Validação de regras concluída", kind: "teal" }
  ];
  const s = row.canonicalStatus;
  if (s !== "rascunho") {
    items.push({ time: fmt(t(2)), text: "Emissão no banco concluída", kind: "ok" });
    items.push({ time: fmt(t(3)), text: "PDF salvo em storage privado", kind: "ok" });
  }
  if (s === "enviada" || s === "pendente_pagamento" || s === "paga" || s === "vencida") {
    items.push({ time: fmt(t(4)), text: "Mensagem enviada ao cliente", kind: "teal" });
  }
  if (s === "paga") {
    items.push({ time: fmt(t(5)), text: "Pagamento conciliado", kind: "ok" });
  }
  if (s === "vencida") {
    items.push({ time: fmt(t(6)), text: "Título vencido sem liquidação", kind: "info" });
  }
  if (s === "cancelada") {
    items.push({ time: fmt(t(4)), text: "Cancelamento registrado", kind: "info" });
  }
  if (s === "erro_emissao") {
    items.push({ time: fmt(t(2)), text: "Falha na emissão — requer reprocessamento", kind: "info" });
  }
  return items;
}

function itemClass(kind: TlKind): string {
  if (kind === "ok") {
    return "timeline__item timeline__item--ok";
  }
  if (kind === "info") {
    return "timeline__item timeline__item--info";
  }
  return "timeline__item";
}

export function BoletoDetalhePage(): JSX.Element {
  const { chargeId } = useParams<{ chargeId: string }>();

  const detailQ = useQuery({
    queryKey: ["cobranca", chargeId],
    queryFn: () => fetchPortalCobrancaDetail(chargeId!),
    enabled: Boolean(chargeId),
    refetchInterval: (q) => (shouldPollChargeDetail(q.state.data) ? CHARGE_DETAIL_POLL_MS : false)
  });

  const charge = detailQ.data?.charge;
  const payment = detailQ.data?.payment ?? null;
  const chargeType =
    charge?.type === "pix" || charge?.type === "boleto"
      ? charge.type
      : payment?.type;

  const timeline = charge ? buildTimeline(charge as ChargeRow) : [];

  const showLoading = Boolean(chargeId) && detailQ.isLoading && !detailQ.data;
  const showNotFound = Boolean(chargeId) && !charge && !detailQ.isLoading && !detailQ.isError;

  const meta = (charge?.metadata as Record<string, unknown> | undefined)?.descricao;
  const descricao =
    typeof meta === "string" && meta.trim()
      ? meta.trim()
      : charge?.reference
        ? `Ref. ${charge.reference}`
        : "—";

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <h2 className="shell-page__title">Detalhe do boleto</h2>
        <Link to="/cobrancas" className="btn-secondary">
          Voltar à lista
        </Link>
      </div>

      {!chargeId ? <div className="banner-err">Identificador do boleto inválido.</div> : null}

      {showLoading ? <p className="muted">Carregando…</p> : null}
      {detailQ.isError ? (
        <div className="banner-err">{detailQ.error instanceof Error ? detailQ.error.message : "Erro"}</div>
      ) : null}

      {chargeId && showNotFound ? <div className="banner-err">Boleto não encontrado neste escritório.</div> : null}

      {charge ? (
        <div className="boleto-detail-grid">
          <div className="form-card">
            <h3 className="form-card__title">Resumo do título</h3>
            <dl style={{ margin: 0 }}>
              <div className="boleto-summary__row">
                <dt>Cliente</dt>
                <dd>{chargeClienteNome(charge)}</dd>
              </div>
              <div className="boleto-summary__row">
                <dt>Nosso número</dt>
                <dd style={{ fontVariantNumeric: "tabular-nums" }}>{nossoNumeroDisplay(charge)}</dd>
              </div>
              <div className="boleto-summary__row">
                <dt>Banco</dt>
                <dd>{bankLabel(charge)}</dd>
              </div>
              <div className="boleto-summary__row">
                <dt>Valor</dt>
                <dd>{formatMoney(charge.amount)}</dd>
              </div>
              <div className="boleto-summary__row">
                <dt>Vencimento</dt>
                <dd>{formatDueFull(charge.dueDate)}</dd>
              </div>
              <div className="boleto-summary__row">
                <dt>Competência</dt>
                <dd>{competenciaFromDue(charge.dueDate)}</dd>
              </div>
              <div className="boleto-summary__row">
                <dt>Descrição</dt>
                <dd>{descricao}</dd>
              </div>
              <div className="boleto-summary__row">
                <dt>Status</dt>
                <dd>
                  <span className={chargeStatusPillClass(charge.canonicalStatus)}>
                    {chargeStatusLabelPortal(charge.canonicalStatus)}
                  </span>
                </dd>
              </div>
            </dl>
            <ChargePaymentPanel
              payment={payment}
              chargeStatus={charge.canonicalStatus}
              chargeType={chargeType}
            />
            <p className="form-note" style={{ marginTop: "0.75rem" }}>
              WhatsApp + e-mail (roadmap)
            </p>
          </div>
          <div className="form-card">
            <h3 className="form-card__title">Linha do tempo do boleto</h3>
            <p className="form-note" style={{ marginTop: 0 }}>
              Ilustração operacional derivada do status atual; eventos reais virão da API de auditoria.
            </p>
            <div className="timeline" style={{ marginTop: "0.75rem" }}>
              {timeline.map((it) => (
                <div key={it.time + it.text} className={itemClass(it.kind)}>
                  <span className="timeline__time">{it.time}</span>
                  <span className="timeline__text">{it.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
