import { Link } from "react-router-dom";

type Props = {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function PlaceholderPage({ title, description, children }: Props): JSX.Element {
  return (
    <div className="shell-page">
      <h2 className="shell-page__title">{title}</h2>
      <p className="shell-page__desc">{description}</p>
      <div className="page-placeholder">
        <p>Funcionalidade em evolução no roadmap do produto.</p>
        {children ?? (
          <p className="small">
            <Link to="/dashboard" className="link-inline">
              Voltar ao dashboard
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
