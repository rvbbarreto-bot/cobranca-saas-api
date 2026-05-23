import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link } from "react-router-dom";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // eslint-disable-next-line no-console
    console.error("[PageErrorBoundary]", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div className="shell-page">
          <div className="banner-err form-card--full">
            <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Erro ao carregar esta pagina</h2>
            <p style={{ margin: "0.5rem 0" }}>{this.state.error.message}</p>
            <p className="muted small" style={{ margin: 0 }}>
              Se o problema persistir, volte a lista e tente novamente.
            </p>
          </div>
          <Link to="/clientes" className="btn-secondary" style={{ marginTop: "1rem", display: "inline-block" }}>
            Voltar aos clientes
          </Link>
        </div>
      );
    }
    return this.props.children;
  }
}
