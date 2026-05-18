import { describe, expect, it, vi, beforeEach } from "vitest";

const { enqueueMock } = vi.hoisted(() => ({
  enqueueMock: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("../../src/platform/jobs/enqueue-notification", () => ({
  enqueueNotificationJob: enqueueMock
}));

import { processNfseCallback } from "../../src/modules/nfse/application/process-nfse-callback";

describe("processNfseCallback", () => {
  beforeEach(() => {
    enqueueMock.mockClear();
  });

  it("atualiza nfse e enfileira notificação quando autorizado", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        const q = sql.toLowerCase();
        if (q.includes("select") && q.includes("nfse_emissions")) {
          return {
            rows: [
              {
                tenant_id: "tenant-1",
                charge_id: "charge-1",
                status: "emitindo"
              }
            ]
          };
        }
        return { rowCount: 1 };
      })
    };

    const result = await processNfseCallback(client as never, {
      referencia: "charge-1",
      status: "autorizado",
      numero_nfse: "123",
      pdf_url: "https://pdf"
    });

    expect(result.applied).toBe(true);
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: "nfse_emitida", chargeId: "charge-1" }),
      expect.objectContaining({ jobId: "nfse-notif-charge-1" })
    );
  });

  it("idempotente quando já autorizado", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        const q = sql.toLowerCase();
        if (q.includes("select")) {
          return {
            rows: [{ tenant_id: "t", charge_id: "c", status: "autorizado" }]
          };
        }
        return { rowCount: 1 };
      })
    };

    const result = await processNfseCallback(client as never, {
      referencia: "c",
      status: "autorizado"
    });

    expect(result.applied).toBe(false);
    expect(enqueueMock).not.toHaveBeenCalled();
  });
});
