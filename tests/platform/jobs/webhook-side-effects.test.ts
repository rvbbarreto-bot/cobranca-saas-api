import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isJobsEnabled: vi.fn(() => true),
  cancelReguaJobsForCharge: vi.fn(async () => undefined),
  enqueuePaymentConfirmedNotification: vi.fn(async () => undefined),
  enqueueReguaNotificationJob: vi.fn(async () => undefined),
  emitN8nPlatformEvent: vi.fn()
}));

vi.mock("../../../src/platform/jobs/redis-connection", () => ({
  isJobsEnabled: mocks.isJobsEnabled
}));

vi.mock("../../../src/platform/jobs/enqueue-notification", () => ({
  cancelReguaJobsForCharge: mocks.cancelReguaJobsForCharge,
  enqueuePaymentConfirmedNotification: mocks.enqueuePaymentConfirmedNotification,
  enqueueReguaNotificationJob: mocks.enqueueReguaNotificationJob,
  reguaJobId: (chargeId: string, daysOffset: number) => `regua-${chargeId}-${daysOffset}`
}));

vi.mock("../../../src/platform/integrations/n8n-outbound", () => ({
  emitN8nPlatformEvent: mocks.emitN8nPlatformEvent
}));

import { applyWebhookSideEffectPlan } from "../../../src/platform/jobs/application/webhook-side-effects";

const tenantId = "00000000-0000-4000-8000-000000000010";
const chargeId = "10000000-0000-4000-8000-000000000020";

describe("applyWebhookSideEffectPlan — n8n outbound", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isJobsEnabled.mockReturnValue(true);
  });

  it("payment_overdue enfileira regua e emite charge.overdue", async () => {
    await applyWebhookSideEffectPlan({
      kind: "payment_overdue",
      chargeId,
      tenantId
    });

    expect(mocks.enqueueReguaNotificationJob).toHaveBeenCalledTimes(2);
    expect(mocks.emitN8nPlatformEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "charge.overdue",
        tenant_id: tenantId,
        payload: { charge_id: chargeId }
      })
    );
  });

  it("payment_cancelled cancela regua e emite charge.cancelled", async () => {
    await applyWebhookSideEffectPlan({
      kind: "payment_cancelled",
      chargeId,
      tenantId
    });

    expect(mocks.cancelReguaJobsForCharge).toHaveBeenCalledWith(chargeId);
    expect(mocks.emitN8nPlatformEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "charge.cancelled",
        tenant_id: tenantId,
        payload: { charge_id: chargeId }
      })
    );
  });

  it("payment_confirmed emite charge.paid", async () => {
    await applyWebhookSideEffectPlan({
      kind: "payment_confirmed",
      chargeId,
      tenantId
    });

    expect(mocks.emitN8nPlatformEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "charge.paid", payload: { charge_id: chargeId } })
    );
  });

  it("nao executa efeitos se jobs desligados", async () => {
    mocks.isJobsEnabled.mockReturnValue(false);

    await applyWebhookSideEffectPlan({
      kind: "payment_overdue",
      chargeId,
      tenantId
    });

    expect(mocks.enqueueReguaNotificationJob).not.toHaveBeenCalled();
    expect(mocks.emitN8nPlatformEvent).not.toHaveBeenCalled();
  });
});
