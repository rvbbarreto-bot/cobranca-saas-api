export type OrganizationType = "exeq" | "escritorio" | "bpo" | "franqueado" | "parceiro";
export type OrganizationStatus = "trial" | "active" | "suspended";

export type OrganizationRow = {
  id: string;
  slug: string;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  parentOrganizationId: string | null;
  automacaoTenantId: string | null;
  createdAt: string;
  updatedAt: string;
};
