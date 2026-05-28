import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  brDateToIso,
  isoToBrDate,
  maskBrDateInput,
  minDueDateIso,
  parseIsoDateOnly,
  toIsoDateOnly,
  type PortalChargeRules
} from "../lib/gateway-charge-rules";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Props = {
  id: string;
  label: string;
  valueIso: string;
  onChangeIso: (iso: string) => void;
  rules: PortalChargeRules;
  /** Quando definido, substitui o minimo de vencimento das regras de cobranca (ex.: filtros de relatorio). */
  minIso?: string;
  maxIso?: string;
  disabled?: boolean;
  required?: boolean;
  error?: string;
};

function buildMonthDays(
  year: number,
  month: number,
  minTs: number,
  maxTs: number | null
): Array<{ iso: string; day: number; disabled: boolean }> {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const out: Array<{ iso: string; day: number; disabled: boolean }> = [];
  for (let d = 1; d <= last.getDate(); d += 1) {
    const iso = toIsoDateOnly(new Date(year, month, d));
    const ts = parseIsoDateOnly(iso)?.getTime() ?? 0;
    const afterMax = maxTs != null && ts > maxTs;
    out.push({ iso, day: d, disabled: ts < minTs || afterMax });
  }
  const pad = first.getDay();
  for (let i = 0; i < pad; i += 1) {
    out.unshift({ iso: "", day: 0, disabled: true });
  }
  return out;
}

export function BrDatePicker({
  id,
  label,
  valueIso,
  onChangeIso,
  rules,
  minIso,
  maxIso,
  disabled,
  required,
  error
}: Props): JSX.Element {
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => isoToBrDate(valueIso));
  const [open, setOpen] = useState(false);
  const effectiveMinIso = useMemo(
    () => minIso?.trim() || minDueDateIso(rules),
    [minIso, rules]
  );
  const todayIso = useMemo(() => toIsoDateOnly(new Date()), []);

  useEffect(() => {
    setText(isoToBrDate(valueIso));
  }, [valueIso]);

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const parsed = parseIsoDateOnly(valueIso) ?? parseIsoDateOnly(effectiveMinIso) ?? new Date();
  const [viewYear, setViewYear] = useState(parsed.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed.getMonth());
  const minTs = parseIsoDateOnly(effectiveMinIso)?.getTime() ?? 0;
  const maxTs = useMemo(() => {
    const m = maxIso?.trim();
    if (!m) {
      return null;
    }
    return parseIsoDateOnly(m)?.getTime() ?? null;
  }, [maxIso]);
  const days = useMemo(
    () => buildMonthDays(viewYear, viewMonth, minTs, maxTs),
    [viewYear, viewMonth, minTs, maxTs]
  );

  function pickIso(iso: string): void {
    if (!iso) {
      return;
    }
    const ts = parseIsoDateOnly(iso)?.getTime() ?? 0;
    if (ts < minTs) {
      return;
    }
    if (maxTs != null && ts > maxTs) {
      return;
    }
    onChangeIso(iso);
    setText(isoToBrDate(iso));
    setOpen(false);
  }

  function onTextBlur(): void {
    const iso = brDateToIso(text);
    if (iso) {
      pickIso(iso);
    }
  }

  function cellClass(iso: string, disabledCell: boolean): string {
    const parts = ["br-date-picker__cell"];
    if (iso === valueIso) {
      parts.push("br-date-picker__cell--selected");
    } else if (iso === todayIso) {
      parts.push("br-date-picker__cell--today");
    }
    return parts.join(" ");
  }

  return (
    <div className="br-date-picker" ref={wrapRef}>
      <label htmlFor={id}>
        {label}
        {required ? <span className="field-required" aria-hidden="true"> *</span> : null}
      </label>
      <div className="br-date-picker__row">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="DD/MM/AAAA"
          value={text}
          disabled={disabled}
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-err` : undefined}
          onChange={(e) => {
            const masked = maskBrDateInput(e.target.value);
            setText(masked);
            const iso = brDateToIso(masked);
            if (iso) {
              onChangeIso(iso);
            }
          }}
          onBlur={onTextBlur}
        />
        <button
          type="button"
          className="btn-secondary br-date-picker__btn"
          disabled={disabled}
          aria-expanded={open}
          aria-controls={listId}
          aria-label={open ? "Fechar calendário" : "Abrir calendário"}
          onClick={() => setOpen((o) => !o)}
        >
          Calendário
        </button>
      </div>
      {open ? (
        <div id={listId} className="br-date-picker__popover" role="dialog" aria-label="Selecionar data">
          <div className="br-date-picker__nav">
            <button
              type="button"
              className="br-date-picker__nav-btn"
              aria-label="Mês anterior"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewYear((y) => y - 1);
                  setViewMonth(11);
                } else {
                  setViewMonth((m) => m - 1);
                }
              }}
            >
              ‹
            </button>
            <span className="br-date-picker__nav-title">
              {String(viewMonth + 1).padStart(2, "0")}/{viewYear}
            </span>
            <button
              type="button"
              className="br-date-picker__nav-btn"
              aria-label="Próximo mês"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewYear((y) => y + 1);
                  setViewMonth(0);
                } else {
                  setViewMonth((m) => m + 1);
                }
              }}
            >
              ›
            </button>
          </div>
          <div className="br-date-picker__weekdays" aria-hidden="true">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w} className="br-date-picker__weekday">
                {w}
              </span>
            ))}
          </div>
          <div className="br-date-picker__grid" role="grid">
            {days.map((cell, idx) =>
              cell.day === 0 ? (
                <span key={`pad-${idx}`} className="br-date-picker__cell br-date-picker__cell--empty" />
              ) : (
                <button
                  key={cell.iso}
                  type="button"
                  className={cellClass(cell.iso, cell.disabled)}
                  disabled={cell.disabled}
                  aria-label={`${cell.day}/${String(viewMonth + 1).padStart(2, "0")}/${viewYear}`}
                  aria-pressed={cell.iso === valueIso}
                  onClick={() => pickIso(cell.iso)}
                >
                  {cell.day}
                </button>
              )
            )}
          </div>
        </div>
      ) : null}
      {error ? (
        <span id={`${id}-err`} className="err" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
