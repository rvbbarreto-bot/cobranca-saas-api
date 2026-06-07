import { describe, expect, it } from "vitest";
import { processFiscalCaptureJob } from "../../src/platform/jobs/application/fiscal-capture-processor";

const basePayload = {
  publicTenantUuid: "00000000-0000-4000-8000-000000000001",
  automacaoTenantId: "tenant-real-capture",
  portalClienteId: "550e8400-e29b-41d4-a716-446655440000",
  tipoGuia: "DAS" as const,
  competencia: "2026-05",
  idempotencyKey: "idem-fiscal-real-capture-001"
};

describe("processFiscalCaptureJob — gateway Receita", () => {
  it("aceita DARF como tipo de captura (Fase 2.1)", async () => {
    await expect(
      processFiscalCaptureJob({
        ...basePayload,
        tipoGuia: "DARF",
        idempotencyKey: "idem-fiscal-darf-allowed",
        codigoReceita: "0561",
        periodoApuracao: "2026-05-31"
      })
    ).rejects.not.toThrow(/DAS/);
  });
});
