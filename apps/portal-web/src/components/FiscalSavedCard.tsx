import { formatFiscalConfigDateTime } from "../lib/fiscal-config-ui";

type FiscalSavedCardProps = {
  title: string;
  statusLabel: string;
  statusPillClass?: string;
  rows: { label: string; value: string; extra?: JSX.Element | null }[];
  updatedAt?: string;
  footer?: JSX.Element | null;
};

export function FiscalSavedCard(props: FiscalSavedCardProps): JSX.Element {
  const pillClass = props.statusPillClass ?? "status-pill status-pill--ativo";
  return (
    <div className="fiscal-saved-card" data-testid="fiscal-saved-card">
      <div className="fiscal-saved-card__header">
        <strong>{props.title}</strong>
        <span className={pillClass}>{props.statusLabel}</span>
      </div>
      <dl className="fiscal-saved-card__grid">
        {props.rows.map((row) => (
          <div key={row.label} className="fiscal-saved-card__row">
            <dt>{row.label}</dt>
            <dd>
              {row.value}
              {row.extra ?? null}
            </dd>
          </div>
        ))}
      </dl>
      {props.updatedAt ? (
        <p className="muted fiscal-saved-card__meta">Atualizado em {formatFiscalConfigDateTime(props.updatedAt)}</p>
      ) : null}
      {props.footer ?? null}
    </div>
  );
}
