import type { PortalMembershipContext } from "../../../shared/types/portal-membership";
import type { AuthContext, TenantContext } from "../../../shared/types/request-context";

export type PortalClienteContext = {
  clienteId: string;
  automacaoTenantId: string;
};

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
      authContext?: AuthContext;
      correlationId?: string;
      portalMembership?: PortalMembershipContext;
      portalCliente?: PortalClienteContext;
    }
  }
}

export {};
