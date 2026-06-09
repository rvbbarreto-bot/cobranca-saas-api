import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WORKFLOW_PATH = join(
  process.cwd(),
  "docs/n8n/workflows/fiscal-capture-darf-stub-homolog.workflow.json"
);

describe("fiscal-capture-darf-stub-homolog.workflow.json", () => {
  it("define payload DARF com codigo_receita e periodo_apuracao", () => {
    const raw = readFileSync(WORKFLOW_PATH, "utf8");
    const wf = JSON.parse(raw) as {
      name: string;
      nodes: { name: string; parameters?: { jsonBody?: string } }[];
    };

    expect(wf.name).toMatch(/DARF/i);

    const postNode = wf.nodes.find((n) => n.name === "POST inbox fiscal DARF");
    expect(postNode).toBeDefined();
    const body = postNode!.parameters?.jsonBody ?? "";
    expect(body).toContain('"tipo_guia": "DARF"');
    expect(body).toContain("codigo_receita");
    expect(body).toContain("periodo_apuracao");
    expect(body).toContain("fiscal.capture.requested");
    expect(body).toContain("idempotency_key");

    const payloadNode = wf.nodes.find((n) => n.name === "Payload fiscal DARF");
    const assignments = JSON.stringify(payloadNode?.parameters ?? {});
    expect(assignments).toContain(":DARF");
  });

  it("expoe variaveis n8n para codigo receita e periodo apuracao", () => {
    const raw = readFileSync(WORKFLOW_PATH, "utf8");
    expect(raw).toContain("FISCAL_DARF_CODIGO_RECEITA");
    expect(raw).toContain("FISCAL_DARF_PERIODO_APURACAO");
  });
});
