import { describe, expect, it } from "vitest";
import { processFiscalCaptureJob } from "../../src/platform/jobs/application/fiscal-capture-processor";

const basePayload = {
  publicTenantUuid: "00000000-0000-4000-8000-000000000001",
  automacaoTenantId: "tenant-a",
  portalClienteId: "550e8400-e29b-41d4-a716-446655440000",
  tipoGuia: "DAS" as const,
  competencia: "2026-04",
  idempotencyKey: "idem-fiscal-test-001"
};

describe("processFiscalCaptureJob (fase 0 skeleton)", () => {
  it("rejeita payload sem idempotencyKey", async () => {
    await expect(
      processFiscalCaptureJob({
        ...basePayload,
        idempotencyKey: ""
      })
    ).rejects.toThrow(/idempotencyKey/);
  });
});
