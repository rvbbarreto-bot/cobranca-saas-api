import { describe, expect, it } from "vitest";
import { buildTimelineFromEvents, extractEmissionError } from "./charge-detail-timeline";

describe("charge-detail-timeline", () => {
  it("monta linha do tempo a partir de eventos reais", () => {
    const items = buildTimelineFromEvents([
      {
        event_type: "charge.created",
        old_status: null,
        new_status: "rascunho",
        created_at: "2026-05-23T03:16:51.623Z"
      },
      {
        event_type: "erro_emissao",
        old_status: "rascunho",
        new_status: "erro_emissao",
        created_at: "2026-05-23T03:18:23.411Z",
        payload_json: { error: "SSL alert unknown ca" }
      }
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]?.text).toContain("criado");
    expect(items[1]?.kind).toBe("err");
  });

  it("extrai mensagem amigável para unknown ca", () => {
    const msg = extractEmissionError([
      {
        event_type: "erro_emissao",
        old_status: "rascunho",
        new_status: "erro_emissao",
        created_at: "2026-05-23T03:18:23.411Z",
        payload_json: { error: "unknown ca" }
      }
    ]);
    expect(msg).toMatch(/Inter/i);
  });
});
