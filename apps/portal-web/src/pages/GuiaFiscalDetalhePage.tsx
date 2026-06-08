import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { GuiaFiscalPdfDownloadButton } from "../components/GuiaFiscalPdfDownloadButton";
import { ShellPageHeader } from "../components/ShellPageHeader";
import {
  fetchGuiaFiscal,
  fetchPortalMe,
  fetchProcessamentosFiscais,
  postGuiaPagamento
} from "../lib/api";
import { resolveProcessamentoIdForGuia } from "../lib/guia-fiscal-download";
import {
  guiaFiscalComplianceLabel,
  guiaFiscalCompliancePillClass,
  guiaFiscalStatusLabel,
  guiaFiscalStatusPillClass,
  tipoGuiaLabel,
  tipoGuiaPillClass
} from "../lib/guia-fiscal-ui";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type GuiaDetalheLocationState = {
  processamentoId?: string;
};

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function GuiaFiscalDetalhePage(): JSX.Element {
  const { guiaId = "" } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const [pdfErr, setPdfErr] = useState<string | null>(null);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [payErr, setPayErr] = useState<string | null>(null);
  const [valorPago, setValorPago] = useState("");
  const [dataPagamento, setDataPagamento] = useState(todayIsoDate());
  const [meio, setMeio] = useState<"manual" | "pix" | "boleto" | "conciliacao">("manual");

  const navState = location.state as GuiaDetalheLocationState | null;
  const processamentoFromQuery = searchParams.get("processamento");

  const me = useQuery({ queryKey: ["portalMe"], queryFn: fetchPortalMe, staleTime: 60_000 });
  const isAdmin = me.data?.user.membership_role === "admin_escritorio";

  const q = useQuery({
    queryKey: ["guiaFiscal", guiaId],
    queryFn: () => fetchGuiaFiscal(guiaId),
    enabled: Boolean(guiaId)
  });

  const g = q.data?.guia;

  const processamentoQ = useQuery({
    queryKey: ["processamentoByGuia", guiaId],
    queryFn: async () => {
      const { processamentos } = await fetchProcessamentosFiscais();
      return processamentos.find((row) => row.guia_fiscal_id === guiaId) ?? null;
    },
    enabled: Boolean(guiaId && g?.tipo_guia === "DAS" && !navState?.processamentoId && !processamentoFromQuery),
    staleTime: 60_000
  });

  const linkedProcessamentoId = useMemo(
    () =>
      resolveProcessamentoIdForGuia({
        stateProcessamentoId: navState?.processamentoId,
        queryProcessamentoId: processamentoFromQuery,
        processamentoFromList: processamentoQ.data
      }),
    [navState?.processamentoId, processamentoFromQuery, processamentoQ.data]
  );

  const canRegisterPayment =
    isAdmin && g && (g.status === "DISPONIVEL" || g.status === "VENCIDO");

  const registerPayment = useMutation({
    mutationFn: () =>
      postGuiaPagamento(guiaId, {
        valor_pago: Number(valorPago.replace(",", ".")),
        data_pagamento: dataPagamento,
        meio
      }),
    onSuccess: async () => {
      setPayErr(null);
      setPayMsg("Pagamento registrado. Guia marcada como PAGA.");
      await qc.invalidateQueries({ queryKey: ["guiaFiscal", guiaId] });
      await qc.invalidateQueries({ queryKey: ["guiasFiscais"] });
    },
    onError: (e: unknown) => {
      setPayMsg(null);
      setPayErr(e instanceof Error ? e.message : "Erro ao registrar pagamento");
    }
  });

  function onPaySubmit(e: FormEvent): void {
    e.preventDefault();
    setPayMsg(null);
    setPayErr(null);
    registerPayment.mutate();
  }

  const pageTitle = g ? `Guia ${g.tipo_guia} — competência ${g.competencia}` : "Guia fiscal";

  return (
    <div className="shell-page guia-detail-page">
      <ShellPageHeader
        title={pageTitle}
        description={
          g
            ? `${tipoGuiaLabel(g.tipo_guia)} · ${guiaFiscalStatusLabel(g.status)} · ${money.format(g.valor_total)}`
            : undefined
        }
        actions={
          g ? (
            <GuiaFiscalPdfDownloadButton
              guiaId={guiaId}
              guia={g}
              fullWidth
              onError={setPdfErr}
            />
          ) : undefined
        }
        below={
          <nav className="guia-detail-trail" aria-label="Navegação da guia">
            <Link to="/guias-fiscais" className="link-inline">
              ← Voltar às guias
            </Link>
            {linkedProcessamentoId ? (
              <>
                <span className="guia-detail-trail__sep" aria-hidden="true">
                  ·
                </span>
                <Link to={`/processamentos-fiscais/${linkedProcessamentoId}`} className="link-inline">
                  Ver transmissão PGDASD
                </Link>
              </>
            ) : null}
          </nav>
        }
      />

      {q.isLoading ? <p className="muted">Carregando…</p> : null}
      {q.isError ? (
        <div className="banner-err">{q.error instanceof Error ? q.error.message : "Erro ao carregar"}</div>
      ) : null}

      {g ? (
        <>
          <div
            className={`guia-detail-header guia-detail-header--${g.tipo_guia.toLowerCase()}`}
            style={{ marginBottom: "1rem" }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <span className={tipoGuiaPillClass(g.tipo_guia)}>{tipoGuiaLabel(g.tipo_guia)}</span>
              <span className={guiaFiscalStatusPillClass(g.status)}>{guiaFiscalStatusLabel(g.status)}</span>
              <span className={guiaFiscalCompliancePillClass(g.compliance_status)}>
                {guiaFiscalComplianceLabel(g.compliance_status)}
              </span>
            </div>
          </div>

          <dl className="detail-list">
            <dt>ID</dt>
            <dd>{g.id}</dd>
            <dt>Tipo</dt>
            <dd>{tipoGuiaLabel(g.tipo_guia)}</dd>
            <dt>Competência</dt>
            <dd>{g.competencia}</dd>
            <dt>Status</dt>
            <dd>{guiaFiscalStatusLabel(g.status)}</dd>
            <dt>Compliance</dt>
            <dd>{guiaFiscalComplianceLabel(g.compliance_status)}</dd>
            <dt>Valor principal</dt>
            <dd>{money.format(g.valor_principal)}</dd>
            <dt>Valor total</dt>
            <dd>{money.format(g.valor_total)}</dd>
            <dt>Vencimento</dt>
            <dd>{g.data_vencimento ?? "—"}</dd>
            <dt>Linha digitável</dt>
            <dd>{g.linha_digitavel ?? "—"}</dd>
            <dt>PIX copia e cola</dt>
            <dd style={{ wordBreak: "break-all" }}>{g.pix_copia_cola ?? "—"}</dd>
          </dl>

          <div className="guia-detail-actions" data-testid="guia-detail-actions">
            <GuiaFiscalPdfDownloadButton
              guiaId={guiaId}
              guia={g}
              fullWidth
              onError={setPdfErr}
            />
            {linkedProcessamentoId ? (
              <Link
                to={`/processamentos-fiscais/${linkedProcessamentoId}`}
                className="btn-secondary guia-pdf-download-btn guia-pdf-download-btn--full"
              >
                Ver transmissão PGDASD
              </Link>
            ) : null}
          </div>
          {pdfErr ? (
            <p className="form-error" role="alert">
              {pdfErr}
            </p>
          ) : null}

          {canRegisterPayment ? (
            <form className="form-card" style={{ marginTop: "1.5rem" }} onSubmit={onPaySubmit}>
              <h3 style={{ marginTop: 0 }}>Registrar pagamento manual</h3>
              <label className="field-label">
                Valor pago
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={valorPago}
                  onChange={(e) => setValorPago(e.target.value)}
                  placeholder={String(g.valor_total)}
                />
              </label>
              <label className="field-label">
                Data pagamento
                <input
                  type="date"
                  required
                  value={dataPagamento}
                  onChange={(e) => setDataPagamento(e.target.value)}
                />
              </label>
              <label className="field-label">
                Meio
                <select value={meio} onChange={(e) => setMeio(e.target.value as typeof meio)}>
                  <option value="manual">Manual</option>
                  <option value="pix">PIX</option>
                  <option value="boleto">Boleto</option>
                  <option value="conciliacao">Conciliação</option>
                </select>
              </label>
              <button type="submit" className="btn-primary" disabled={registerPayment.isPending}>
                {registerPayment.isPending ? "A guardar…" : "Marcar como paga"}
              </button>
              {payMsg ? <p className="form-success">{payMsg}</p> : null}
              {payErr ? <p className="form-error">{payErr}</p> : null}
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
