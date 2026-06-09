import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiscalAdminGate } from "../components/FiscalAdminGate";
import { FiscalA1PemPair, type FiscalA1PemState } from "../components/FiscalA1PemPair";
import { FiscalSavedCard } from "../components/FiscalSavedCard";
import {
  ApiError,
  fetchCertificadoDigital,
  fetchClientes,
  fetchExpiringCertificates,
  postCertificadoDigital,
  type CertificadoDigitalRow,
  type ClienteRow
} from "../lib/api";
import {
  certificadoExpiryBadgeLabel,
  certificadoExpiryPillClass,
  certificadoExpiryTone,
  certificadoVigenciaLabel
} from "../lib/fiscal-config-ui";

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

function CertificadoFormSection(props: {
  cliente: ClienteRow;
  savedCert: CertificadoDigitalRow | null;
  isLoading: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [certLabel, setCertLabel] = useState("Certificado A1");
  const [certValidFrom, setCertValidFrom] = useState(todayIsoDate());
  const [certValidUntil, setCertValidUntil] = useState(oneYearFromToday());
  const [pemState, setPemState] = useState<FiscalA1PemState>({
    ready: false,
    certificadoPem: "",
    chavePrivadaPem: ""
  });

  const onPemChange = useCallback((state: FiscalA1PemState) => {
    setPemState(state);
  }, []);

  useEffect(() => {
    const cert = props.savedCert;
    if (cert) {
      setCertLabel(cert.label);
      setCertValidFrom(cert.valid_from);
      setCertValidUntil(cert.valid_until);
    } else {
      setCertLabel("Certificado A1");
      setCertValidFrom(todayIsoDate());
      setCertValidUntil(oneYearFromToday());
    }
  }, [props.savedCert, props.cliente.id]);

  const saveCert = useMutation({
    mutationFn: () =>
      postCertificadoDigital({
        portal_cliente_id: props.cliente.id,
        label: certLabel.trim(),
        valid_from: certValidFrom,
        valid_until: certValidUntil,
        certificado_pem: pemState.certificadoPem.trim(),
        chave_privada_pem: pemState.chavePrivadaPem.trim()
      }),
    onSuccess: async (data) => {
      setSaveErr(null);
      setSaveMsg(`Certificado cadastrado (${data.certificado.label}).`);
      await queryClient.invalidateQueries({ queryKey: ["fiscalCertificado", props.cliente.id] });
      await queryClient.invalidateQueries({ queryKey: ["fiscalExpiringCerts"] });
      await queryClient.invalidateQueries({ queryKey: ["fiscalCertList"] });
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
    if (!pemState.ready) {
      setSaveErr("Envie certificado e chave privada válidos (PEM).");
      return;
    }
    saveCert.mutate();
  }

  return (
    <div style={{ marginTop: "1.25rem" }} data-testid="fiscal-cert-form-section">
      <p className="muted">
        Empresa selecionada: <strong>{props.cliente.nome}</strong> ({formatDocBR(props.cliente.documento)})
      </p>

      {props.isLoading ? <p className="muted">A carregar certificado…</p> : null}

      {props.savedCert ? (
        <div style={{ marginTop: "0.75rem" }}>
          <FiscalSavedCard
            title="Certificado cadastrado"
            statusLabel="Ativo"
            updatedAt={props.savedCert.updated_at}
            rows={[
              { label: "Rótulo", value: props.savedCert.label },
              { label: "Vigência", value: certificadoVigenciaLabel(props.savedCert) }
            ]}
          />
        </div>
      ) : !props.isLoading ? (
        <p className="muted" data-testid="fiscal-cert-empty">
          Nenhum certificado ativo para esta empresa.
        </p>
      ) : null}

      {saveMsg ? <p className="form-success" style={{ marginTop: "0.75rem" }}>{saveMsg}</p> : null}
      {saveErr ? <p className="form-error" style={{ marginTop: "0.75rem" }}>{saveErr}</p> : null}

      <form className="form-card" style={{ marginTop: "1rem" }} onSubmit={onSubmit}>
        <h3 style={{ marginTop: 0 }}>{props.savedCert ? "Substituir certificado A1" : "Cadastrar certificado A1"}</h3>
        <p className="muted" style={{ fontSize: "0.9rem" }}>
          PEM cifrado na API (AES-256-GCM). Use drag-drop ou seleção de arquivo.
        </p>
        <label className="field-label">
          Rótulo
          <input value={certLabel} onChange={(e) => setCertLabel(e.target.value)} required maxLength={80} />
        </label>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <label className="field-label">
            Válido de
            <input type="date" value={certValidFrom} onChange={(e) => setCertValidFrom(e.target.value)} required />
          </label>
          <label className="field-label">
            Válido até
            <input type="date" value={certValidUntil} onChange={(e) => setCertValidUntil(e.target.value)} required />
          </label>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(16rem, 1fr))",
            gap: "1rem",
            marginTop: "0.75rem"
          }}
        >
          <FiscalA1PemPair disabled={saveCert.isPending} onStateChange={onPemChange} />
        </div>
        <button
          type="submit"
          className="btn-primary"
          style={{ marginTop: "1rem" }}
          disabled={saveCert.isPending || !pemState.ready}
        >
          {saveCert.isPending ? "A guardar…" : props.savedCert ? "Substituir certificado" : "Cadastrar certificado"}
        </button>
      </form>
    </div>
  );
}

export function FiscalCertificadosPage(): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedClienteId = searchParams.get("cliente") ?? "";

  const clientesQ = useQuery({
    queryKey: ["fiscalCertList", "clientes"],
    queryFn: () => fetchClientes({ limit: 100 })
  });

  const expiringQ = useQuery({
    queryKey: ["fiscalExpiringCerts"],
    queryFn: () => fetchExpiringCertificates()
  });

  const clientes = clientesQ.data?.data ?? [];
  const expiringByCliente = useMemo(() => {
    const map = new Map<string, { days_left: number; valid_until: string; label: string }>();
    for (const c of expiringQ.data?.certificados ?? []) {
      if (c.portal_cliente_id) {
        map.set(c.portal_cliente_id, {
          days_left: c.days_left,
          valid_until: c.valid_until,
          label: c.label
        });
      }
    }
    return map;
  }, [expiringQ.data?.certificados]);

  const certQueries = useQueries({
    queries: clientes.map((c) => ({
      queryKey: ["fiscalCertificado", c.id],
      queryFn: () => fetchCertificadoDigital(c.id),
      enabled: clientes.length > 0
    }))
  });

  const certByClienteId = useMemo(() => {
    const map = new Map<string, CertificadoDigitalRow | null>();
    clientes.forEach((c, i) => {
      map.set(c.id, certQueries[i]?.data?.certificado ?? null);
    });
    return map;
  }, [clientes, certQueries]);

  const selectedCliente = clientes.find((c) => c.id === selectedClienteId) ?? null;
  const selectedCertQuery = useQuery({
    queryKey: ["fiscalCertificado", selectedClienteId],
    queryFn: () => fetchCertificadoDigital(selectedClienteId),
    enabled: Boolean(selectedClienteId)
  });

  return (
    <FiscalAdminGate
      title="Certificados A1"
      description="Gestão de certificados digitais por empresa — transmissão PGDASD e captura fiscal."
    >
      {(expiringQ.data?.certificados ?? []).length > 0 ? (
        <div className="form-card" style={{ marginTop: "1rem" }} data-testid="fiscal-expiring-banner">
          <strong>Atenção — certificados a expirar</strong>
          {(expiringQ.data?.certificados ?? []).slice(0, 5).map((c) => (
            <p key={c.id} style={{ margin: "0.35rem 0" }}>
              {c.label}: {certificadoExpiryBadgeLabel(c)} (até {c.valid_until})
            </p>
          ))}
        </div>
      ) : null}

      <div className="table-wrap" style={{ marginTop: "1rem" }}>
        <table className="data-table" data-testid="fiscal-cert-list">
          <thead>
            <tr>
              <th>Empresa</th>
              <th>CNPJ</th>
              <th>Certificado</th>
              <th>Vigência</th>
              <th>Expiração</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {clientes.map((c) => {
              const cert = certByClienteId.get(c.id);
              const exp = expiringByCliente.get(c.id);
              const tone = cert
                ? certificadoExpiryTone({ valid_until: cert.valid_until, days_left: exp?.days_left })
                : "unknown";
              return (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td>{formatDocBR(c.documento)}</td>
                  <td>{cert ? cert.label : "—"}</td>
                  <td>{cert ? certificadoVigenciaLabel(cert) : "—"}</td>
                  <td>
                    {cert ? (
                      <span className={certificadoExpiryPillClass(tone)}>
                        {certificadoExpiryBadgeLabel({
                          valid_until: cert.valid_until,
                          days_left: exp?.days_left
                        })}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <Link
                      to={`/fiscal/certificados?cliente=${encodeURIComponent(c.id)}`}
                      className={selectedClienteId === c.id ? "btn-primary" : "btn-secondary"}
                      style={{ fontSize: "0.85rem", padding: "0.25rem 0.6rem" }}
                    >
                      {cert ? "Gerir" : "Cadastrar"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {clientesQ.isLoading ? <p className="muted">A carregar empresas…</p> : null}
      {clientes.length === 0 && !clientesQ.isLoading ? (
        <p className="muted">Cadastre clientes com CNPJ antes de configurar certificados.</p>
      ) : null}

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
          <CertificadoFormSection
            cliente={selectedCliente}
            savedCert={selectedCertQuery.data?.certificado ?? null}
            isLoading={selectedCertQuery.isLoading}
          />
        </>
      ) : (
        <p className="muted" style={{ marginTop: "1rem" }}>
          Selecione <strong>Cadastrar</strong> ou <strong>Gerir</strong> na tabela para enviar o par PEM.
        </p>
      )}
    </FiscalAdminGate>
  );
}
