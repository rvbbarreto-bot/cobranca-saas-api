import { describe, expect, it, vi, beforeEach } from "vitest";

const { addMock } = vi.hoisted(() => ({
  addMock: vi.fn().mockResolvedValue({ id: "job-1" })
}));

vi.mock("../../../src/platform/jobs/redis-connection", () => ({
  isJobsEnabled: () => true
}));

vi.mock("../../../src/platform/jobs/queues", () => ({
  getQueues: () => ({
    paymentEmission: { add: addMock }
  }),
  queues: {
    paymentEmission: { add: addMock }
  },
  JOB_OPTS: {
    emission: {
      attempts: 3,
      backoff: { type: "exponential", delay: 30_000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 }
    }
  }
}));

describe("enqueuePaymentEmissionJob", () => {
  beforeEach(() => {
    addMock.mockClear();
  });

  it("adiciona job emit-charge na fila charges-emission", async () => {
    const { enqueuePaymentEmissionJob } = await import(
      "../../../src/platform/jobs/enqueue-payment-emission"
    );

    await enqueuePaymentEmissionJob({
      id: "charge-uuid",
      tenantId: "tenant-uuid"
    });

    expect(addMock).toHaveBeenCalledWith(
      "emit-charge",
      { chargeId: "charge-uuid", tenantId: "tenant-uuid" },
      expect.objectContaining({ attempts: 3 })
    );
  });
});
