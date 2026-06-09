import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiscalAdminGate } from "../components/FiscalAdminGate";
import { FiscalSavedCard } from "../components/FiscalSavedCard";
import {
  ApiError,
  fetchClientes,
  fetchProcuracao,
  postProcuracao,
  postValidarProcuracaoSerpro,
  type ClienteRow,
  type ProcuracaoRow
} from "../lib/api";
import {
  formatProcuradorDocumento,
  procuracaoTipoLabel,
  procuracaoVigenciaLabel,
  serproSituacaoSemaphoreClass,
  serproSituacaoTone
} from "../lib/fiscal-config-ui";
import { serproProcuracaoSituacaoLabel } from "../lib/processamento-fiscal-ui";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function oneYearFromToday(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function formatDocBR(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) {
    return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

function readSerproSituacao(proc: ProcuracaoRow | null | undefined): string | undefined {
  if (!proc?.metadata || typeof proc.metadata.serpro_situacao !== "string") {
    return undefined;
  }
  return proc.metadata.serpro_situacao;
}

function SerproSemaphore(props: { situacao: string | undefined; label?: string }): JSX.Element {
  const tone = serproSituacaoTone(props.situacao);
  return (
    <span className={serproSituacaoSemaphoreClass(tone)} data-testid="fiscal-serpro-semaphore" title={props.label}>
      <span className="fiscal-semaphore__dot" aria-hidden="true" />
      <span>{serproProcuracaoSituacaoLabel(props.situacao)}</span>
    </span>
  );
}

function ProcuracaoFormSection(props: {
  cliente: ClienteRow;
  savedProc: ProcuracaoRow | null;
  isLoading: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [procTipo, setProcTipo] = useState<"ecac" | "receita_federal" | "outro">("ecac");
  const [procDocumento, setProcDocumento] = useState("");
  const [procInicio, setProcInicio] = useState(todayIsoDate());
  const [procFim, setProcFim] = useState(oneYearFromToday());

  useEffect(() => {
    const proc = props.savedProc;
    if (proc) {
      setProcTipo(proc.tipo);
      setProcDocumento(proc.procurador_documento);
      setProcInicio(proc.validade_inicio);
      setProcFim(proc.validade_fim);
    } else {
      setProcTipo("ecac");
      setProcDocumento("");
      setProcInicio(todayIsoDate());
      setProcFim(oneYearFromToday());
    }
  }, [props.savedProc, props.cliente.id]);

  const validarSerpro = useMutation({
    mutationFn: () =>
      postValidarProcuracaoSerpro({
        portal_cliente_id: props.cliente.id,
        contribuinte_cnpj: props.cliente.documento.replace(/\D/g, "")
      }),
    onSuccess: async (data) => {
      setSaveMsg(`Validação SERPRO: ${data.mensagem}`);
      await queryClient.invalidateQueries({ queryKey: ["fiscalProcuracao", props.cliente.id] });
      await queryClient.invalidateQueries({ queryKey: ["fiscalProcList"] });
    },
    onError: (e: unknown) => {
      setSaveErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Erro SERPRO.");
    }
  });

  const saveProc = useMutation({
    mutationFn: () =>
      postProcuracao({
        portal_cliente_id: props.cliente.id,
        tipo: procTipo,
        procurador_documento: procDocumento.replace(/\D/g, ""),
        validade_inicio: procInicio,
        validade_fim: procFim,
        ativa: true
      }),
    onSuccess: async (data) => {
      setSaveErr(null);
      setSaveMsg(`Procuração cadastrada (${procuracaoTipoLabel(data.procuracao.tipo)}).`);
      await queryClient.invalidateQueries({ queryKey: ["fiscalProcuracao", props.cliente.id] });
      await queryClient.invalidateQueries({ queryKey: ["fiscalProcList"] });
    },
    onError: (e: unknown) => {
      setSaveMsg(null);
      setSaveErr(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Erro ao cadastrar.");
    }
  });

  function onSubmit(e: FormEvent): void {
    e.preventDefault();
    setSaveMsg(null);
    setSaveErr(null);
    saveProc.mutate();
  }

  const serproSituacao = readSerproSituacao(props.savedProc);
  const serproTone = serproSituacaoTone(serproSituacao);

  return (
    <div style={{ marginTop: "1.25rem" }} data-testid="fiscal-proc-form-section">
      <p className="muted">
        Empresa: <strong>{props.cliente.nome}</strong> ({formatDocBR(props.cliente.documento)})
      </p>

      {props.isLoading ? <p className="muted">A carregar procuração…</p> : null}

      {props.savedProc ? (
        <div style={{ marginTop: "0.75rem" }}>
          <FiscalSavedCard
            title="Procuração cadastrada"
            statusLabel="Ativa"
            updatedAt={props.savedProc.updated_at}
            rows={[
              { label: "Tipo", value: procuracaoTipoLabel(props.savedProc.tipo) },
              { label: "Procurador", value: formatProcuradorDocumento(props.savedProc.procurador_documento) },
              { label: "Vigência", value: procuracaoVigenciaLabel(props.savedProc) },
              {
                label: "Diagnóstico SERPRO",
                value: "",
                extra: <SerproSemaphore situacao={serproSituacao} />
              }
            ]}
            footer={
              <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-primary"
                  data-testid="fiscal-validar-serpro-btn"
                  disabled={validarSerpro.isPending}
                  onClick={() => validarSerpro.mutate()}
                >
                  {validarSerpro.isPending ? "Validando na SERPRO…" : "Validar no SERPRO"}
                </button>
                {serproTone === "green" ? (
                  <span className="muted">Pronto para transmissão PGDASD.</span>
                ) : null}
              </div>
            }
          />
        </div>
      ) : !props.isLoading ? (
        <p className="muted" data-testid="fiscal-proc-empty">
          Nenhuma procuração ativa para esta empresa.
        </p>
      ) : null}

      {saveMsg ? <p className="form-success" style={{ marginTop: "0.75rem" }}>{saveMsg}</p> : null}
      {saveErr ? <p className="form-error" style={{ marginTop: "0.75rem" }}>{saveErr}</p> : null}

      <form className="form-card" style={{ marginTop: "1rem" }} onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0 }}>{props.savedProc ? "Atualizar procuração" : "Cadastrar procuração"}</h3>
        <label className="field-label">
          Tipo
          <select value={procTipo} onChange={(e) => setProcTipo(e.target.value as typeof procTipo)}>
            <option value="ecac">e-CAC</option>
            <option value="receita_federal">Receita Federal</option>
            <option value="outro">Outro</option>
          </select>
        </label>
        <label className="field-label">
          CPF/CNPJ do procurador
          <input value={procDocumento} onChange={(e) => setProcDocumento(e.target.value)} required />
        </label>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <label className="field-label">
            Validade início
            <input type="date" value={procInicio} onChange={(e) => setProcInicio(e.target.value)} required />
          </label>
          <label className="field-label">
            Validade fim
            <input type="date" value={procFim} onChange={(e) => setProcFim(e.target.value)} required />
          </label>
        </div>
        <button type="submit" className="btn-primary" style={{ marginTop: "1rem" }} disabled={saveProc.isPending}>
          {saveProc.isPending ? "A guardar…" : props.savedProc ? "Salvar procuração" : "Cadastrar procuração"}
        </button>
      </form>
    </div>
  );
}

export function FiscalProcuracoesPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClienteId = searchParams.get("cliente") ?? "";

  const clientesQ = useQuery({
    queryKey: ["fiscalProcList", "clientes"],
    queryFn: () => fetchClientes({ limit: 100 })
  });

  const clientes = clientesQ.data?.data ?? [];

  const procQueries = useQueries({
    queries: clientes.map((c) => ({
      queryKey: ["fiscalProcuracao", c.id],
      queryFn: () => fetchProcuracao(c.id),
      enabled: clientes.length > 0
    }))
  });

  const procByClienteId = useMemo(() => {
    const map = new Map<string, ProcuracaoRow | null>();
    clientes.forEach((c, i) => {
      map.set(c.id, procQueries[i]?.data?.procuracao ?? null);
    });
    return map;
  }, [clientes, procQueries]);

  const selectedCliente = clientes.find((c) => c.id === selectedClienteId) ?? null;
  const selectedProcQ = useQuery({
    queryKey: ["fiscalProcuracao", selectedClienteId],
    queryFn: () => fetchProcuracao(selectedClienteId),
    enabled: Boolean(selectedClienteId)
  });

  return (
    <FiscalAdminGate
      title="Procurações fiscais"
      description="Procuração e-CAC por empresa com diagnóstico SERPRO (semáforo) para transmissão PGDASD."
    >
      <div className="table-wrap" style={{ marginTop: "1rem" }}>
        <table className="data-table" data-testid="fiscal-proc-list">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>CNPJ</th>
              <th>Procuração</th>
              <th>Vigência</th>
              <th>SERPRO</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => {
              const proc = procByClienteId.get(c.id);
              const situacao = readSerproSituacao(proc);
              return (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{formatDocBR(c.documento)}</td>
                  <td>{proc ? procuracaoTipoLabel(proc.tipo) : "—"}</td>
                  <td>{proc ? procuracaoVigenciaLabel(proc) : "—"}</td>
                  <td>
                    {proc ? <SerproSemaphore situacao={situacao} /> : <span className="muted">—</span>}
                  </td>
                  <td>
                    <Link
                      to={`/fiscal/procuracoes?cliente=${encodeURIComponent(c.id)}`}
                      className={selectedClienteId === c.id ? "btn-primary" : "btn-secondary"}
                      style={{ fontSize: "0.85rem", padding: "0.25rem 0.6rem" }}
                    >
                      {proc ? "Gerir" : "Cadastrar"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selectedCliente ? (
        <>
          <button
            type="button"
            className="btn-secondary"
            style={{ marginTop: "1rem" }}
            onClick={() => setSearchParams({})}
          >
            Fechar formulário
          </button>
          <ProcuracaoFormSection
            cliente={selectedCliente}
            savedProc={selectedProcQ.data?.procuracao ?? null}
            isLoading={selectedProcQ.isLoading}
          />
        </>
      ) : (
        <p className="muted" style={{ marginTop: "1rem" }}>
          Selecione uma empresa na tabela para cadastrar ou validar a procuração na SERPRO.
        </p>
      )}
    </FiscalAdminGate>
  );
}
