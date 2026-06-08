import { describe, expect, it } from "vitest";
import {
  certificateDaysUntilExpiry,
  certificateExpiryAlertThreshold
} from "../../src/modules/fiscal-guias/infrastructure/certificate-vault-expiry-repository";

describe("certificate expiry alerts", () => {
  it("dispara alerta em 30, 15 e 7 dias", () => {
    expect(certificateExpiryAlertThreshold(31)).toBeNull();
    expect(certificateExpiryAlertThreshold(30)).toBe(30);
    expect(certificateExpiryAlertThreshold(15)).toBe(15);
    expect(certificateExpiryAlertThreshold(7)).toBe(7);
    expect(certificateExpiryAlertThreshold(1)).toBe(7);
  });

  it("calcula dias restantes", () => {
    const future = new Date();
    future.setDate(future.getDate() + 10);
    const iso = future.toISOString().slice(0, 10);
    expect(certificateDaysUntilExpiry(iso)).toBeGreaterThanOrEqual(9);
  });
});
