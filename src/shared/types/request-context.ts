export type UserRole =
  | "owner"
  | "admin"
  | "finance"
  | "support"
  | "viewer"
  | "service_account";

export type TenantContext = {
  tenantId: string;
  tenantSlug?: string;
};

export type AuthContext = {
  userId: string;
  roles: UserRole[];
  tenantId: string;
};
