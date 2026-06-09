import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const fiscalQueuesMock = vi.fn();
const fiscalEnabledMock = vi.fn();

vi.mock("../../src/platform/persistence/pool", () => ({
  getPool: () => ({ query: queryMock })
}));

vi.mock("../../src/platform/config/fiscal-guias-enabled", () => ({
  isFiscalGuiasEnabled: () => fiscalEnabledMock()
}));

vi.mock("../../src/platform/jobs/fiscal-queue-monitor", () => ({
  getAllFiscalQueueSnapshots: (...args: unknown[]) => fiscalQueuesMock(...args),
  sumFiscalQueueDepthFromSnapshots: (snapshots: Array<{ counts: Record<string, number> }>) =>
    snapshots.reduce(
      (acc, s) => acc + (s.counts.waiting ?? 0) + (s.counts.delayed ?? 0) + (s.counts.active ?? 0),
      0
    )
}));

import { computeFiscalSliSnapshots } from "../../src/platform/observability/fiscal-sli-metrics";

describe("computeFiscalSliSnapshots", () => {
  beforeEach(() => {
    queryMock.mockReset();
    fiscalQueuesMock.mockReset();
    fiscalEnabledMock.mockReset();
  });

  it("retorna vazio quando fiscal desligado", async () => {
    fiscalEnabledMock.mockReturnValue(false);
    const res = await computeFiscalSliSnapshots();
    expect(res.fiscalEnabled).toBe(false);
    expect(res.slis).toEqual([]);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("calcula SLIs quando fiscal habilitado", async () => {
    fiscalEnabledMock.mockReturnValue(true);
    fiscalQueuesMock.mockResolvedValue([
      { name: "fiscal-serpro-transmit", counts: { waiting: 4, active: 1 } }
    ]);
    queryMock
      .mockResolvedValueOnce({ rows: [{ p95_seconds: "45.5" }] })
      .mockResolvedValueOnce({ rows: [{ error_rate_pct: "2.5", total: "40" }] });

    const res = await computeFiscalSliSnapshots();
    expect(res.fiscalEnabled).toBe(true);
    expect(res.queueDepth).toBe(5);
    expect(res.slis).toHaveLength(3);

    const depth = res.slis.find((s) => s.id === "fiscal_queue_depth");
    expect(depth?.value).toBe(5);
    expect(depth?.status).toBe("ok");

    const p95 = res.slis.find((s) => s.id === "fiscal_transmit_latency_p95");
    expect(p95?.value).toBe(45.5);
    expect(p95?.status).toBe("ok");

    const err = res.slis.find((s) => s.id === "fiscal_serpro_error_rate");
    expect(err?.value).toBe(2.5);
    expect(err?.status).toBe("ok");
  });

  it("marca breach quando taxa erro SERPRO alta", async () => {
    fiscalEnabledMock.mockReturnValue(true);
    fiscalQueuesMock.mockResolvedValue([]);
    queryMock
      .mockResolvedValueOnce({ rows: [{ p95_seconds: null }] })
      .mockResolvedValueOnce({ rows: [{ error_rate_pct: "15", total: "20" }] });

    const res = await computeFiscalSliSnapshots();
    const err = res.slis.find((s) => s.id === "fiscal_serpro_error_rate");
    expect(err?.status).toBe("breach");
  });
});
