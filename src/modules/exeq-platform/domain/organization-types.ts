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

/** Contrato HTTP EXEQ — snake_case alinhado a `/v1/exeq/escritorios`. */
export type OrganizationPublic = {
  id: string;
  slug: string;
  name: string;
  type: OrganizationType;
  status: OrganizationStatus;
  parent_organization_id: string | null;
  automacao_tenant_id: string | null;
  created_at: string;
  updated_at: string;
};

export function mapOrganizationPublic(org: OrganizationRow): OrganizationPublic {
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    type: org.type,
    status: org.status,
    parent_organization_id: org.parentOrganizationId,
    automacao_tenant_id: org.automacaoTenantId,
    created_at: org.createdAt,
    updated_at: org.updatedAt
  };
}
