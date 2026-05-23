import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchEscritorioConfig, fetchPortalCobrancaDetail } from "../lib/api";
import { ChargeShareActions } from "../components/ChargeShareActions";
import { useHashScroll } from "../hooks/useHashScroll";
import { useCliente } from "../hooks/useCliente";
import { getPortalChargeRules } from "../lib/gateway-charge-rules";
import { CHARGE_DETAIL_POLL_MS, shouldPollChargeDetail } from "../lib/charge-detail-poll";
import {
  buildTimelineFromEvents,
  extractEmissionError
} from "../lib/charge-detail-timeline";
import { ChargePaymentPanel } from "../components/ChargePaymentPanel";
import { ReprocessEmissionButton } from "../components/ReprocessEmissionButton";
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

function formatDueFull(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return iso;
  }
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function itemClass(kind: "info" | "teal" | "ok" | "err"): string {
  if (kind === "ok") {
    return "timeline__item timeline__item--ok";
  }
  if (kind === "err") {
    return "timeline__item timeline__item--info";
  }
  if (kind === "info") {
    return "timeline__item timeline__item--info";
  }
  return "timeline__item";
}

function portalClienteIdFromMetadata(metadata: Record<string, unknown> | undefined): string | undefined {
  const raw = metadata?.portal_cliente_id;
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

export function BoletoDetalhePage(): JSX.Element {
  const { chargeId } = useParams<{ chargeId: string }>();
  useHashScroll(Boolean(chargeId));

  const configQ = useQuery({ queryKey: ["escritorio-config"], queryFn: fetchEscritorioConfig });
  const gatewayRules = getPortalChargeRules(configQ.data?.config?.gateway_provider);

  const detailQ = useQuery({
    queryKey: ["cobranca", chargeId],
    queryFn: () => fetchPortalCobrancaDetail(chargeId!),
    enabled: Boolean(chargeId),
    refetchInterval: (q) => (shouldPollChargeDetail(q.state.data) ? CHARGE_DETAIL_POLL_MS : false)
  });

  const charge = detailQ.data?.charge;
  const events = detailQ.data?.events ?? [];
  const payment = detailQ.data?.payment ?? null;
  const chargeMeta = charge?.metadata as Record<string, unknown> | undefined;
  const portalClienteId = portalClienteIdFromMetadata(chargeMeta);
  const clienteQ = useCliente(portalClienteId);
  const emissionError = extractEmissionError(events);
  const timeline = events.length > 0 ? buildTimelineFromEvents(events) : [];

  const chargeType =
    charge?.type === "pix" || charge?.type === "boleto"
      ? charge.type
      : payment?.type;

  const showLoading = Boolean(chargeId) && detailQ.isLoading && !detailQ.data;
  const showNotFound = Boolean(chargeId) && !charge && !detailQ.isLoading && !detailQ.isError;

  const meta = (charge?.metadata as Record<string, unknown> | undefined)?.descricao;
  const descricao =
    typeof meta === "string" && meta.trim()
      ? meta.trim()
      : charge?.reference
        ? `Ref. ${charge.reference}`
        : "—";

  const polling =
    charge &&
    charge.canonicalStatus === "rascunho" &&
    !payment;

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <h2 className="shell-page__title">Detalhe do boleto</h2>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {charge && isChargeEditable(charge.canonicalStatus) ? (
            <Link to={`/cobrancas/${chargeId}/editar`} className="btn-primary">
              Editar
            </Link>
          ) : null}
          {charge?.canonicalStatus === "erro_emissao" && chargeId ? (
            <ReprocessEmissionButton chargeId={chargeId} className="btn-primary" />
          ) : null}
          <Link to="/cobrancas" className="btn-secondary">
            Voltar à lista
          </Link>
        </div>
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
            {emissionError ? <div className="banner-err">{emissionError}</div> : null}
            {polling ? (
              <div className="banner-ok" style={{ marginBottom: "0.75rem" }}>
                Emissão em andamento — a página atualiza automaticamente.
              </div>
            ) : null}
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
              showPixQr={gatewayRules.supportsPix}
            />
            <ChargeShareActions
              clienteNome={chargeClienteNome(charge)}
              clienteTelefone={clienteQ.data?.telefone}
              clienteEmail={clienteQ.data?.email}
              amountLabel={formatMoney(charge.amount)}
              dueLabel={formatDueFull(charge.dueDate)}
              payment={payment}
            />
          </div>
          <div id="timeline" className="form-card">
            <h3 className="form-card__title">Linha do tempo do boleto</h3>
            <p className="form-note" style={{ marginTop: 0 }}>
              Eventos registrados pela API para esta cobrança.
            </p>
            <div className="timeline" style={{ marginTop: "0.75rem" }}>
              {timeline.length === 0 ? (
                <p className="muted">Nenhum evento registrado ainda.</p>
              ) : (
                timeline.map((it) => (
                  <div key={`${it.time}-${it.text}`} className={itemClass(it.kind)}>
                    <span className="timeline__time">{it.time}</span>
                    <span className="timeline__text">{it.text}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
