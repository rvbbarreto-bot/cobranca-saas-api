import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult
} from "@playwright/test/reporter";
import { ASAAS_RESULT_JSON, EVIDENCE_DIR, SCENARIOS_MD } from "../helpers/constants";

type ScenarioRecord = {
  feature: string;
  scenario: string;
  status: "Passou" | "Falhou" | "Ignorado";
  durationMs: number;
  error?: string;
  file?: string;
};

type AsaasEvidencePayload = {
  generatedAt: string;
  playwrightRun: boolean;
  summary: { passed: number; failed: number; skipped: number };
  scenarios: ScenarioRecord[];
  networkSamples: unknown[];
  asaasScript?: unknown;
  githubWorkflow?: unknown;
  consoleErrors: string[];
};

function parseMeta(title: string): { feature: string; scenario: string } {
  const feat = title.match(/\[Feature:\s*([^\]]+)\]/i)?.[1]?.trim();
  const scen = title.match(/\[Cenário:\s*([^\]]+)\]/i)?.[1]?.trim();
  if (feat && scen) {
    return { feature: feat, scenario: scen };
  }
  const parts = title.split("—").map((s) => s.trim());
  return {
    feature: parts[0] ?? "Geral",
    scenario: parts[1] ?? title
  };
}

export default class EvidenceReporter implements Reporter {
  private scenarios: ScenarioRecord[] = [];
  private rootDir = process.cwd();

  onBegin(config: FullConfig): void {
    this.rootDir = config.configFile ? dirname(config.configFile) : process.cwd();
    if (this.rootDir.endsWith("e2e")) {
      this.rootDir = dirname(this.rootDir);
    }
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const meta = parseMeta(test.title);
    const st: ScenarioRecord["status"] =
      result.status === "skipped"
        ? "Ignorado"
        : result.status === "passed"
          ? "Passou"
          : "Falhou";

    this.scenarios.push({
      feature: meta.feature,
      scenario: meta.scenario,
      status: st,
      durationMs: result.duration,
      error: result.error?.message,
      file: test.location.file
    });
  }

  onEnd(result: FullResult): void {
    const outDir = join(this.rootDir, EVIDENCE_DIR);
    mkdirSync(outDir, { recursive: true });

    const passed = this.scenarios.filter((s) => s.status === "Passou").length;
    const failed = this.scenarios.filter((s) => s.status === "Falhou").length;
    const skipped = this.scenarios.filter((s) => s.status === "Ignorado").length;

    let asaasMerge: Record<string, unknown> = {};
    const asaasPath = join(this.rootDir, ASAAS_RESULT_JSON);
    if (existsSync(asaasPath)) {
      try {
        asaasMerge = JSON.parse(readFileSync(asaasPath, "utf8")) as Record<string, unknown>;
      } catch {
        asaasMerge = {};
      }
    }

    const payload: AsaasEvidencePayload = {
      generatedAt: new Date().toISOString(),
      playwrightRun: true,
      summary: { passed, failed, skipped },
      scenarios: this.scenarios,
      networkSamples: (asaasMerge.networkSamples as unknown[]) ?? [],
      asaasScript: asaasMerge.asaasScript,
      githubWorkflow: asaasMerge.githubWorkflow,
      consoleErrors: (asaasMerge.consoleErrors as string[]) ?? []
    };

    writeFileSync(asaasPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

    const md = this.buildMarkdown(payload, result);
    writeFileSync(join(this.rootDir, SCENARIOS_MD), md, "utf8");
  }

  private buildMarkdown(payload: AsaasEvidencePayload, result: FullResult): string {
    const lines: string[] = [
      "# Relatório de cenários — Playwright E2E",
      "",
      `**Gerado em:** ${payload.generatedAt}`,
      `**Duração total:** ${(result.duration / 1000).toFixed(1)}s`,
      "",
      "## Resumo",
      "",
      "| Status | Quantidade |",
      "|--------|------------|",
      `| Passou | ${payload.summary.passed} |`,
      `| Falhou | ${payload.summary.failed} |`,
      `| Ignorado | ${payload.summary.skipped} |`,
      "",
      "## Cenários por feature",
      ""
    ];

    const byFeature = new Map<string, ScenarioRecord[]>();
    for (const s of payload.scenarios) {
      const list = byFeature.get(s.feature) ?? [];
      list.push(s);
      byFeature.set(s.feature, list);
    }

    for (const [feat, items] of byFeature) {
      lines.push(`### ${feat}`, "");
      lines.push("| Cenário | Status | Duração (ms) | Notas |");
      lines.push("|---------|--------|--------------|-------|");
      for (const item of items) {
        const note = item.error ? item.error.replace(/\|/g, "\\|").split("\n")[0] : "—";
        lines.push(`| ${item.scenario} | **${item.status}** | ${item.durationMs} | ${note} |`);
      }
      lines.push("");
    }

    if (payload.asaasScript) {
      lines.push("## Homolog Asaas (script / workflow)", "");
      lines.push("```json");
      lines.push(JSON.stringify({ asaasScript: payload.asaasScript, githubWorkflow: payload.githubWorkflow }, null, 2));
      lines.push("```", "");
    }

    lines.push("---", "", "*Gerado por `e2e/reporters/evidence-reporter.ts` (Playwright)*");
    return lines.join("\n");
  }
}

/** Título padronizado para o reporter extrair Feature/Cenário. */
export function bddTitle(featureName: string, scenarioName: string): string {
  return `[Feature: ${featureName}] [Cenário: ${scenarioName}]`;
}
