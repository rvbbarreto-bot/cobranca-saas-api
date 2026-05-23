import type { ReactNode } from "react";

type Props = {
  title: string;
  hint: string;
  children: ReactNode;
  defaultOpen?: boolean;
};

export function EmBreveSection({ title, hint, children, defaultOpen = false }: Props): JSX.Element {
  return (
    <details className="form-card form-card--collapsible" open={defaultOpen}>
      <summary className="form-card__title form-card__title--summary">
        {title}
        <span className="badge-em-breve">Em breve</span>
      </summary>
      <p className="form-note form-note--block">{hint}</p>
      {children}
    </details>
  );
}
