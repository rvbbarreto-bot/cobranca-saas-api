export type PortalMembershipRole = "admin_escritorio" | "operador" | "cliente_cnpj";

export type PortalMembershipContext = {
  role: PortalMembershipRole;
  cpfCnpjCliente: string | null;
};

export function parsePortalMembershipRole(value: string): PortalMembershipRole | null {
  if (value === "admin_escritorio" || value === "operador" || value === "cliente_cnpj") {
    return value;
  }
  return null;
}
