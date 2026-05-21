import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isJobsEnabled: vi.fn(() => true),
  add: vi.fn(async () => undefined),
  emitN8nPlatformEvent: vi.fn()
}));

vi.mock("../../../src/platform/jobs/redis-connection", () => ({
  isJobsEnabled: mocks.isJobsEnabled
}));

vi.mock("../../../src/platform/jobs/queues", () => ({
  getQueues: () => ({
    notificationSend: { add: mocks.add }
  }),
  JOB_OPTS: { notification: { attempts: 1 } }
}));

vi.mock("../../../src/platform/integrations/n8n-outbound", () => ({
  emitN8nPlatformEvent: mocks.emitN8nPlatformEvent
}));

import { enqueueReguaNotificationJob } from "../../../src/platform/jobs/enqueue-notification";

describe("enqueueReguaNotificationJob — n8n", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isJobsEnabled.mockReturnValue(true);
  });

  it("emite notification.regua_enqueued apos enfileirar", async () => {
    await enqueueReguaNotificationJob({
      chargeId: "c-1",
      tenantId: "t-1",
      eventType: "lembrete_pre_3d",
      daysOffset: -3,
      forceChannel: "email"
    });

    expect(mocks.add).toHaveBeenCalledTimes(1);
    expect(mocks.emitN8nPlatformEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "notification.regua_enqueued",
        tenant_id: "t-1",
        payload: {
          charge_id: "c-1",
          event_type: "lembrete_pre_3d",
          days_offset: -3,
          channel: "email"
        }
      })
    );
  });

  it("nao emite regua_enqueued sem chargeId", async () => {
    await enqueueReguaNotificationJob({
      tenantId: "t-1",
      eventType: "broadcast"
    });

    expect(mocks.add).toHaveBeenCalledTimes(1);
    expect(mocks.emitN8nPlatformEvent).not.toHaveBeenCalled();
  });
});
