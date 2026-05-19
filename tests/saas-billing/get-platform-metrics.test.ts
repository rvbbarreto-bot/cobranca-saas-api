import { describe, expect, it, vi } from "vitest";
import { getPlatformMetricsUseCase } from "../../src/modules/saas-billing/application/get-platform-metrics";

describe("getPlatformMetricsUseCase", () => {
  it("calcula MRR e inadimplencia a partir do repositorio", async () => {
    const pool = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [{ mrr: "598.00" }] })
        .mockResolvedValueOnce({
          rows: [
            { status: "trial", count: "2" },
            { status: "active", count: "3" },
            { status: "past_due", count: "1" },
            { status: "suspended", count: "1" }
          ]
        })
    };

    const metrics = await getPlatformMetricsUseCase(pool as never);

    expect(metrics.mrr).toBe(598);
    expect(metrics.currency).toBe("BRL");
    expect(metrics.tenants_by_status.trial).toBe(2);
    expect(metrics.tenants_by_status.active).toBe(3);
    expect(metrics.inadimplencia).toEqual({ past_due: 1, suspended: 1, total: 2 });
    expect(metrics.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
