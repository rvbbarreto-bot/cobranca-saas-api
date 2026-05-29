import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Job } from "bullmq";

const addMock = vi.fn().mockResolvedValue({ id: "dlq-1" });
const getJobsMock = vi.fn().mockResolvedValue([]);
const getJobMock = vi.fn();
const removeMock = vi.fn();
const getJobCountsMock = vi.fn().mockResolvedValue({ waiting: 1, failed: 0 });

vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: addMock,
    getJobs: getJobsMock,
    getJob: getJobMock,
    getJobCounts: getJobCountsMock
  }))
}));

vi.mock("../../../src/platform/jobs/redis-connection", () => ({
  redisConnection: {}
}));

const primaryAddMock = vi.fn().mockResolvedValue({ id: "new-primary-1" });

vi.mock("../../../src/platform/jobs/queues", () => ({
  QUEUE_PAYMENT_EMISSION: "charges-emission",
  QUEUE_WEBHOOK_PROCESS: "inbox-process",
  QUEUE_NOTIFICATION_SEND: "notifications-send",
  QUEUE_CHARGE_SYNC: "charges-sync",
  getQueues: () => ({
    paymentEmission: { add: primaryAddMock },
    webhookProcess: { add: primaryAddMock },
    notificationSend: { add: primaryAddMock },
    chargeSync: { add: primaryAddMock }
  })
}));

describe("dlq-service", () => {
  beforeEach(() => {
    addMock.mockClear();
    primaryAddMock.mockClear();
    getJobMock.mockReset();
    removeMock.mockReset();
  });

  it("enqueueDlq adiciona job na fila DLQ", async () => {
    const { enqueueDlq } = await import("../../../src/platform/jobs/dlq/dlq-service");
    const id = await enqueueDlq({
      originalQueue: "charges-emission",
      originalJobId: "job-1",
      tenantId: "tenant-1",
      chargeId: "charge-1",
      attemptsMade: 5,
      failedAt: new Date().toISOString(),
      errorCode: "gateway_validation_failed",
      errorMessage: "campo invalido",
      retryable: false,
      payload: { chargeId: "charge-1", tenantId: "tenant-1" }
    });
    expect(id).toBe("dlq-1");
    expect(addMock).toHaveBeenCalledWith(
      "dlq",
      expect.objectContaining({ originalQueue: "charges-emission" }),
      expect.any(Object)
    );
  });

  it("reprocessDlqJob reenfileira na fila primária", async () => {
    getJobMock.mockResolvedValue({
      id: "dlq-1",
      data: {
        originalQueue: "charges-emission",
        payload: { chargeId: "c1", tenantId: "t1" }
      },
      remove: removeMock
    });

    const { reprocessDlqJob } = await import("../../../src/platform/jobs/dlq/dlq-service");
    const newId = await reprocessDlqJob("charges-emission", "dlq-1");
    expect(newId).toBe("new-primary-1");
    expect(primaryAddMock).toHaveBeenCalled();
    expect(removeMock).toHaveBeenCalled();
  });

  it("buildDlqPayloadFromJob inclui campos obrigatórios", async () => {
    const { buildDlqPayloadFromJob } = await import("../../../src/platform/jobs/dlq/dlq-service");
    const job = {
      id: "99",
      data: { tenantId: "t1", chargeId: "c1" },
      attemptsMade: 5
    } as Job<{ tenantId: string; chargeId: string }>;

    const payload = buildDlqPayloadFromJob(job, "charges-emission", {
      errorCode: "gateway_validation_failed",
      errorMessage: "x",
      retryable: false
    });

    expect(payload.tenantId).toBe("t1");
    expect(payload.chargeId).toBe("c1");
    expect(payload.originalJobId).toBe("99");
    expect(payload.retryable).toBe(false);
  });
});
