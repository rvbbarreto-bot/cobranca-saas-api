import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FiscalSectionNav } from "./FiscalSectionNav";
import { ShellPageHeader } from "./ShellPageHeader";
import { fetchPortalMe } from "../lib/api";
import { isFiscalGuiasNavEnabled } from "../lib/fiscal-feature";

type FiscalAdminGateProps = {
  title: string;
  description: string;
  children: JSX.Element | JSX.Element[];
};

export function FiscalAdminGate(props: FiscalAdminGateProps): JSX.Element {
  const fiscalEnabled = isFiscalGuiasNavEnabled();
  const me = useQuery({ queryKey: ["portalMe"], queryFn: fetchPortalMe, staleTime: 60_000 });
  const isAdmin = me.data?.user.membership_role === "admin_escritorio";

  if (!fiscalEnabled) {
    return (
      <div className="shell-page">
        <ShellPageHeader title={props.title} description="Módulo fiscal desligado neste ambiente." />
        <p className="muted">
          Ative <code>VITE_FISCAL_GUIAS_ENABLED=true</code> no portal e <code>FISCAL_GUIAS_ENABLED=true</code> na API.
        </p>
      </div>
    );
  }

  if (me.isLoading) {
    return <p className="muted padded">A carregar…</p>;
  }

  if (!isAdmin) {
    return (
      <div className="shell-page">
        <ShellPageHeader title={props.title} />
        <p className="muted">
          Apenas <strong>admin_escritorio</strong> pode gerir certificados e procurações fiscais.
        </p>
        <p>
          <Link to="/guias-fiscais">Ver guias fiscais</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="shell-page">
      <ShellPageHeader title={props.title} description={props.description} actions={<FiscalSectionNav />} />
      {props.children}
    </div>
  );
}
