import type { PoolClient } from "pg";
import type { Charge } from "../../billing-core/domain/charge";
import {
  assertPortalClienteHasEmissionAddress,
  PORTAL_CLIENTE_ADDRESS_REQUIRED
} from "./portal-cliente-emission-address";
import { resolvePortalChargeRules } from "./validate-portal-charge-create";

export type PortalEmissionValidationIssue = { path: string; message: string };

export class PortalEmissionNotReadyError extends Error {
  readonly issues: PortalEmissionValidationIssue[];

  constructor(issues: PortalEmissionValidationIssue[]) {
    super(issues[0]?.message ?? "Cobranca nao esta pronta para emissao no banco.");
    this.name = "PortalEmissionNotReadyError";
    this.issues = issues;
  }
}

/**
 * Valida pré-requisitos de emissão (cliente, endereço do gateway) antes de
 * enfileirar o job BullMQ — evita reprocessar cobranças que falhariam de novo.
 */
export async function assertPortalChargeEmissionReady(
  client: PoolClient,
  automacaoTenantId: string,
  charge: Charge
): Promise<void> {
  const rules = await resolvePortalChargeRules(client, automacaoTenantId);
  const portalClienteId =
    typeof charge.metadata.portal_cliente_id === "string"
      ? charge.metadata.portal_cliente_id.trim()
      : "";

  if (!portalClienteId) {
    throw new PortalEmissionNotReadyError([
      {
        path: "portal_cliente_id",
        message: "Selecione um cliente (pagador) vinculado a esta cobranca antes de emitir no banco."
      }
    ]);
  }

  if (rules.requiresPayerAddress) {
    try {
      await assertPortalClienteHasEmissionAddress(
        client,
        automacaoTenantId,
        portalClienteId,
        rules.displayName
      );
    } catch (e) {
      if (e instanceof Error && e.message === PORTAL_CLIENTE_ADDRESS_REQUIRED) {
        const withIssues = e as Error & { issues?: PortalEmissionValidationIssue[] };
        throw new PortalEmissionNotReadyError(
          withIssues.issues ?? [
            {
              path: "portal_cliente_id",
              message: `${rules.displayName} exige endereco completo do cliente (CEP, logradouro, bairro, cidade e UF).`
            }
          ]
        );
      }
      throw e;
    }
  }
}
