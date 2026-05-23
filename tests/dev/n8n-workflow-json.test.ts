import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "docs", "n8n", "workflows");

function load(name: string) {
  const raw = readFileSync(join(root, name), "utf8");
  return JSON.parse(raw) as {
    name: string;
    nodes: { id: string; name: string; type: string }[];
    connections: Record<string, unknown>;
  };
}

describe("n8n workflow JSON (homolog)", () => {
  it("cobranca-saas-events importável", () => {
    const w = load("cobranca-saas-events.workflow.json");
    expect(w.name).toContain("Cobrança SaaS");
    expect(w.nodes.length).toBeGreaterThan(5);
    expect(w.connections["Webhook cobranca-saas-events"]).toBeDefined();
    const webhook = w.nodes.find((n) => n.type === "n8n-nodes-base.webhook");
    expect(webhook?.name).toBe("Webhook cobranca-saas-events");
  });

  it("cobranca-saas-inbox-homolog importável", () => {
    const w = load("cobranca-saas-inbox-homolog.workflow.json");
    expect(w.nodes.some((n) => n.type === "n8n-nodes-base.manualTrigger")).toBe(true);
    expect(w.nodes.some((n) => n.type === "n8n-nodes-base.httpRequest")).toBe(true);
  });
});
