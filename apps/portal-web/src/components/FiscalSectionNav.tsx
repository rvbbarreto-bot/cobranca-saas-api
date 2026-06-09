import { Link, useLocation } from "react-router-dom";

const LINKS = [
  { to: "/configuracoes/fiscal", label: "Config. fiscal" },
  { to: "/fiscal/certificados", label: "Certificados" },
  { to: "/fiscal/procuracoes", label: "Procurações" },
  { to: "/configuracoes/fiscal/conexao-receita", label: "Conexão Receita" }
] as const;

export function FiscalSectionNav(): JSX.Element {
  const { pathname } = useLocation();

  return (
    <nav className="fiscal-section-nav" aria-label="Navegação fiscal">
      {LINKS.map((link) => {
        const active =
          pathname === link.to ||
          (link.to !== "/configuracoes/fiscal" && pathname.startsWith(`${link.to}/`));
        return (
          <Link
            key={link.to}
            to={link.to}
            className={`fiscal-section-nav__link${active ? " fiscal-section-nav__link--active" : ""}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
