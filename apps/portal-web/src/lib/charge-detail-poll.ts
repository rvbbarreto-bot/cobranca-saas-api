import type { PortalCobrancaDetailResponse } from "./api";

/** Intervalo de polling enquanto o worker emite no gateway (ms). */
export const CHARGE_DETAIL_POLL_MS = 2500;

export function shouldPollChargeDetail(data: PortalCobrancaDetailResponse | undefined): boolean {
  if (!data) {
    return true;
  }
  const s = data.charge.canonicalStatus;
  if (s === "cancelada" || s === "erro_emissao") {
    return false;
  }
  return !data.payment;
}
