import { Link } from "react-router-dom";
import { FiscalAdminGate } from "../components/FiscalAdminGate";

export function ConfigFiscalPage(): JSX.Element {
  return (
    <FiscalAdminGate
      title="Configuração fiscal"
      description="Hub fiscal do escritório — certificados, procurações e homologação."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(14rem, 1fr))",
          gap: "1rem",
          marginTop: "1rem"
        }}
      >
        <Link to="/fiscal/certificados" className="form-card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3 style={{ marginTop: 0 }}>Certificados A1</h3>
          <p className="muted" style={{ margin: 0 }}>
            Lista por empresa, badges de expiração e upload PEM.
          </p>
        </Link>
        <Link to="/fiscal/procuracoes" className="form-card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3 style={{ marginTop: 0 }}>Procurações</h3>
          <p className="muted" style={{ margin: 0 }}>
            Cadastro e validação SERPRO com semáforo visual.
          </p>
        </Link>
        <Link
          to="/configuracoes/fiscal/conexao-receita"
          className="form-card"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <h3 style={{ marginTop: 0 }}>Conexão Receita Federal</h3>
          <p className="muted" style={{ margin: 0 }}>
            Ambiente demo/prod, CNPJ contratante e credenciais OAuth SERPRO.
          </p>
        </Link>
        <Link to="/processamentos-fiscais/importar" className="form-card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3 style={{ marginTop: 0 }}>Importar PGDASD</h3>
          <p className="muted" style={{ margin: 0 }}>
            CSV de apuração e início da transmissão.
          </p>
        </Link>
        <Link to="/fiscal/auditoria" className="form-card" style={{ textDecoration: "none", color: "inherit" }}>
          <h3 style={{ marginTop: 0 }}>Auditoria fiscal</h3>
          <p className="muted" style={{ margin: 0 }}>
            Trilha read-only de downloads, certificados, capturas e validações SERPRO.
          </p>
        </Link>
      </div>

      <div className="form-card" style={{ marginTop: "1.25rem" }}>
        <h3 style={{ marginTop: 0 }}>Homologação e captura DAS / DARF</h3>
        <ul className="muted" style={{ lineHeight: 1.6 }}>
          <li>
            <strong>Homolog interno:</strong> API com <code>FISCAL_CAPTURE_STUB=true</code> ou mock Receita local.
          </li>
          <li>
            <strong>Produção / piloto:</strong> aguardando URL gateway Receita e credenciais S3/Z-API do cliente.
          </li>
          <li>
            Após certificado + procuração validada na SERPRO, dispare captura via n8n (
            <code>fiscal.capture.requested</code>) ou inbox.
          </li>
          <li>
            Captura <strong>DARF</strong> via inbox (<code>tipo_guia: DARF</code>, <code>codigo_receita</code>).
          </li>
        </ul>
        <p style={{ marginTop: "1rem" }}>
          Documentação: <code>docs/FISCAL_HOMOLOG_E2E.md</code> e <code>docs/FISCAL_TREINAMENTO_ESCRITORIO.md</code>.
        </p>
      </div>
    </FiscalAdminGate>
  );
}
