import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BrDatePicker } from "../components/BrDatePicker";
import { downloadEscritorioCobrancasCsv } from "../lib/api";
import { getPortalChargeRules, toIsoDateOnly } from "../lib/gateway-charge-rules";
import {
  defaultExportDateRange,
  EXPORT_DATE_MIN_ISO,
  validateExportDateRange
} from "../lib/relatorios-export";

export function RelatoriosPage(): JSX.Element {
  const defaults = useMemo(() => defaultExportDateRange(), []);
  const [fromIso, setFromIso] = useState(defaults.from);
  const [toIso, setToIso] = useState(defaults.to);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const pickerRules = useMemo(() => getPortalChargeRules("asaas"), []);
  const todayIso = useMemo(() => toIsoDateOnly(new Date()), []);

  async function onDownload(): Promise<void> {
    setError(null);
    const rangeErr = validateExportDateRange(fromIso, toIso);
    if (rangeErr) {
      setFieldError(rangeErr);
      return;
    }
    setFieldError(null);
    setLoading(true);
    try {
      const blob = await downloadEscritorioCobrancasCsv({ from: fromIso, to: toIso });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cobrancas-${fromIso}_${toIso}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha no export");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell-page">
      <div className="shell-page__head">
        <h2 className="shell-page__title">Relatórios</h2>
        <Link to="/dashboard" className="btn-secondary">
          Dashboard
        </Link>
      </div>
      <p className="muted">
        Exportação de cobranças do escritório (CSV com documentos mascarados). Filtre pelo período de criação da
        cobrança.
      </p>

      {error ? <div className="banner-err">{error}</div> : null}

      <div className="form-card form-card--full">
        <h3 className="form-card__title">Cobranças (CSV)</h3>
        <p className="muted small">
          Período por data de criação. Formato servidor: vírgula, datas pt-BR, até 10.000 linhas.
        </p>

        <div className="form-grid">
          <BrDatePicker
            id="relatorio-from"
            label="Data inicial"
            valueIso={fromIso}
            onChangeIso={(iso) => {
              setFromIso(iso);
              setFieldError(null);
            }}
            rules={pickerRules}
            minIso={EXPORT_DATE_MIN_ISO}
            maxIso={toIso || todayIso}
            required
          />
          <BrDatePicker
            id="relatorio-to"
            label="Data final"
            valueIso={toIso}
            onChangeIso={(iso) => {
              setToIso(iso);
              setFieldError(null);
            }}
            rules={pickerRules}
            minIso={fromIso || EXPORT_DATE_MIN_ISO}
            maxIso={todayIso}
            required
          />
        </div>

        {fieldError ? <div className="banner-err">{fieldError}</div> : null}

        <button type="button" className="btn-primary" disabled={loading} onClick={() => void onDownload()}>
          {loading ? "A gerar…" : "Exportar CSV"}
        </button>
      </div>
    </div>
  );
}
