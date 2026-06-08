import { Link } from "react-router-dom";
import type { ClienteFiscalIndicators } from "../lib/cliente-fiscal-indicators";
import { novaApuracaoImportHref } from "../lib/cliente-fiscal-indicators";

type ClienteFiscalIndicatorsCellProps = {
  clienteId: string;
  indicators: ClienteFiscalIndicators | undefined;
  loading?: boolean;
};

export function ClienteFiscalIndicatorsCell(props: ClienteFiscalIndicatorsCellProps): JSX.Element {
  if (props.loading || !props.indicators) {
    return <span className="muted">…</span>;
  }

  const ind = props.indicators;

  return (
    <div className="cliente-fiscal-indicators" data-testid={`cliente-fiscal-${props.clienteId}`}>
      <span className={ind.certificado.pillClass} title={`Certificado: ${ind.certificado.label}`}>
        {ind.certificado.label}
      </span>
      <span className={ind.procuracao.pillClass} title={`Procuração: ${ind.procuracao.label}`}>
        {ind.procuracao.label}
      </span>
      {ind.processamento.id ? (
        <Link
          to={`/processamentos-fiscais/${ind.processamento.id}`}
          className={ind.processamento.pillClass}
          title={`Último PGDASD: ${ind.processamento.label}`}
        >
          {ind.processamento.label}
        </Link>
      ) : (
        <span className={ind.processamento.pillClass} title="Último PGDASD">
          {ind.processamento.label}
        </span>
      )}
    </div>
  );
}

type ClienteNovaApuracaoLinkProps = {
  clienteId: string;
};

export function ClienteNovaApuracaoLink(props: ClienteNovaApuracaoLinkProps): JSX.Element {
  return (
    <Link
      to={novaApuracaoImportHref(props.clienteId)}
      className="link-inline"
      title="Importar CSV PGDASD para nova apuração"
      data-testid={`nova-apuracao-${props.clienteId}`}
    >
      Nova apuração
    </Link>
  );
}
