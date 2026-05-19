import type { PoolClient } from "pg";
import type { Charge, ChargePaymentView } from "../../billing-core/domain/charge";
import {
  listChargeEvents,
  type ChargeEventRow
} from "../../billing-core/infrastructure/charge-events-repository";
import { getChargeWithLatestPayment } from "../../billing-core/infrastructure/charge-repository";

export type PortalChargeDetail = {
  charge: Charge;
  payment: ChargePaymentView | null;
  events: ChargeEventRow[];
};

export async function getPortalChargeDetailUseCase(
  client: PoolClient,
  chargeId: string,
  tenantId: string
): Promise<PortalChargeDetail | null> {
  const base = await getChargeWithLatestPayment(client, chargeId, tenantId);
  if (!base) {
    return null;
  }
  const events = await listChargeEvents(client, chargeId);
  return { ...base, events };
}
