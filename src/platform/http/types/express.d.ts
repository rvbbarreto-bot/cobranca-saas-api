import type { PortalMembershipContext } from "../../../shared/types/portal-membership";
import type { AuthContext, TenantContext } from "../../../shared/types/request-context";

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
      authContext?: AuthContext;
      correlationId?: string;
      portalMembership?: PortalMembershipContext;
    }
  }
}

export {};
