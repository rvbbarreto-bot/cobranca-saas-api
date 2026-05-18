import { describe, expect, it, vi } from "vitest";
import { insertWebhookInbox } from "../../src/modules/inbox/infrastructure/webhook-inbox-repository";

describe("insertWebhookInbox deduplicacao", () => {
  it("marca alreadyProcessed quando external_event_id ja foi processado", async () => {
    const client = {
      query: vi
        .fn()
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "inbox-1",
              tenant_id: "00000000-0000-4000-8000-000000000001",
              source: "asaas",
              external_event_id: "evt-dup",
              payload: {},
              created_at: new Date(),
              processed_at: new Date()
            }
          ]
        })
    };

    const result = await insertWebhookInbox(client as never, {
      source: "asaas",
      externalEventId: "evt-dup",
      payload: { event: "PAYMENT_CONFIRMED" },
      correlationId: null
    });

    expect(result.inserted).toBe(false);
    expect(result.alreadyProcessed).toBe(true);
  });
});
