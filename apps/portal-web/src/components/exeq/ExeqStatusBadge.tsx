type Props = {
  active: boolean;
  billingStatus?: string | null;
};

export function ExeqStatusBadge({ active, billingStatus }: Props): JSX.Element {
  if (!active) {
    return <span className="exeq-pill exeq-pill--danger">Inativo</span>;
  }
  const billing = billingStatus?.trim().toLowerCase();
  if (billing === "active" || billing === "trial") {
    return <span className="exeq-pill exeq-pill--success">Ativo</span>;
  }
  if (billing === "suspended") {
    return <span className="exeq-pill exeq-pill--warn">Suspenso</span>;
  }
  return <span className="exeq-pill exeq-pill--success">Ativo</span>;
}
