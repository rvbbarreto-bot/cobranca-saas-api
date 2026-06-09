import { describe, expect, it } from "vitest";
import { FISCAL_CSV_INGEST_RATE_LIMIT } from "../../src/platform/config/fiscal-ingest-rate-limit";

describe("FISCAL_CSV_INGEST_RATE_LIMIT (EXEQ-FISC-095)", () => {
  it("limita uploads por tenant a 10 por minuto", () => {
    expect(FISCAL_CSV_INGEST_RATE_LIMIT.maxPerTenant).toBe(10);
    expect(FISCAL_CSV_INGEST_RATE_LIMIT.windowMs).toBe(60_000);
  });
});
