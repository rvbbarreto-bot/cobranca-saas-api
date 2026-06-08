import { Link } from "react-router-dom";
import type { ProcessamentoErroGroup } from "../lib/processamento-fiscal-ui";
import { processamentoErroSuggestedAction } from "../lib/processamento-fiscal-ui";

type ClienteLabelMap = Record<string, string>;

type ProcessamentoErroCentralPanelProps = {
  groups: ProcessamentoErroGroup[];
  clienteLabels: ClienteLabelMap;
  onVerProcessamento?: (processamentoId: string) => void;
};

export function ProcessamentoErroCentralPanel(props: ProcessamentoErroCentralPanelProps): JSX.Element {
  const { groups, clienteLabels } = props;

  if (groups.length === 0) {
    return (
      <div className="form-card" data-testid="fiscal-erro-central-empty">
        <p className="muted" style={{ margin: 0 }}>
          Nenhum erro aberto nos processamentos PGDASD. Quando a transmissão falhar, os casos aparecem aqui
          agrupados por tipo.
        </p>
      </div>
    );
  }

  return (
    <div className="fiscal-erro-central" data-testid="fiscal-erro-central">
      {groups.map((group) => {
        const action = processamentoErroSuggestedAction(group.codigo);
        return (
          <div key={group.codigo} className="form-card fiscal-erro-central__group" data-testid="fiscal-erro-group">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: "0.75rem",
                flexWrap: "wrap"
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 0.35rem" }}>{group.titulo}</h3>
                <p className="muted" style={{ margin: 0 }}>
                  {group.sugestao}
                </p>
                <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.85rem" }}>
                  Código: {group.codigo} · {group.count} ocorrência(s)
                </p>
              </div>
              {action ? (
                <Link to={action.to} className="btn-secondary">
                  {action.label}
                </Link>
              ) : null}
            </div>
            <ul style={{ margin: "1rem 0 0", paddingLeft: "1.25rem" }}>
              {group.processamentos.map((p) => (
                <li key={p.id} style={{ marginBottom: "0.35rem" }}>
                  <Link to={`/processamentos-fiscais/${p.id}`}>
                    {clienteLabels[p.portal_cliente_id] ?? "Empresa"} — {p.competencia}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
