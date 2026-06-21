/**
 * Resolve ambiente sandbox vs producao para adapters de gateway.
 * Inter: preferir GATEWAY_INTER_SANDBOX explicito (evita surpresa com NODE_ENV).
 */
export function isGatewaySandboxMode(provider?: string): boolean {
  const normalized = provider?.trim().toLowerCase();
  if (normalized === "inter") {
    const raw = process.env.GATEWAY_INTER_SANDBOX?.trim().toLowerCase();
    if (raw === "true" || raw === "1") {
      return true;
    }
    if (raw === "false" || raw === "0") {
      return false;
    }
  }

  return process.env.NODE_ENV !== "production";
}
