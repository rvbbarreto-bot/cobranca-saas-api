import type { ReactNode } from "react";

export type ShellPageHeaderProps = {
  title: string;
  description?: string;
  /** Botões alinhados à direita na mesma linha do título */
  actions?: ReactNode;
  /** Conteúdo abaixo da descrição (ex.: nav segmentada fiscal) */
  below?: ReactNode;
};

export function ShellPageHeader(props: ShellPageHeaderProps): JSX.Element {
  return (
    <header className="shell-page__header">
      <div className="shell-page__head-row">
        <h2 className="shell-page__title shell-page__title--inline">{props.title}</h2>
        {props.actions ? <div className="shell-page__actions">{props.actions}</div> : null}
      </div>
      {props.description ? <p className="shell-page__desc">{props.description}</p> : null}
      {props.below ? <div className="shell-page__head-below">{props.below}</div> : null}
    </header>
  );
}
