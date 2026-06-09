import { describe, expect, it } from "vitest";
import {
  sumFiscalQueueDepth,
  sumFiscalQueueDepthFromSnapshots
} from "../../src/platform/jobs/fiscal-queue-monitor";

describe("fiscal queue depth helpers", () => {
  it("soma waiting, delayed e active", () => {
    expect(
      sumFiscalQueueDepth({ waiting: 3, delayed: 2, active: 1, failed: 5, completed: 10 })
    ).toBe(6);
  });

  it("agrega snapshots de multiplas filas", () => {
    expect(
      sumFiscalQueueDepthFromSnapshots([
        { counts: { waiting: 2, active: 1 } },
        { counts: { waiting: 1, delayed: 1 } }
      ])
    ).toBe(5);
  });
});
