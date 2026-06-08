#!/usr/bin/env node
/**
 * Importa backlog SERPRO Fiscal para Jira Cloud via REST API v3.
 *
 * Uso:
 *   node scripts/jira-import-backlog.mjs --discover
 *   node scripts/jira-import-backlog.mjs --dry-run
 *   node scripts/jira-import-backlog.mjs --apply
 *
 * Variáveis: docs/jira-import/.env.example (carregar via .env.jira.local manualmente ou export)
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(ROOT, "docs/jira-import/JIRA_SERPRO_FISCAL_BACKLOG.csv");
const ENV_LOCAL = path.join(ROOT, "docs/jira-import/.env.jira.local");

const EPIC_TITLES = {
  "EXEQ-FISC-E00": "S0 — Discovery SERPRO & Kickoff",
  "EXEQ-FISC-E01": "Fundação — Organização Multi-Tenant",
  "EXEQ-FISC-E02": "Certificate Vault & Procuração SERPRO",
  "EXEQ-FISC-E03": "Motor de Ingestão CSV (modelo canônico)",
  "EXEQ-FISC-E04": "Cliente SERPRO Integra Contador",
  "EXEQ-FISC-E05": "Pipeline Apuração PGDAS-D",
  "EXEQ-FISC-E06": "Recibo & Emissão DAS",
  "EXEQ-FISC-E07": "Portal UX Fiscal MVP (Mobile First)",
  "EXEQ-FISC-E08": "QA, Homologação & DevOps Fiscal",
  "EXEQ-FISC-E09": "Fase 2 — APIs ERP & Webhooks",
  "EXEQ-FISC-E10": "Fase 3 — DCTFWeb SERPRO",
  "EXEQ-FISC-E11": "Fase 4 — Evoluções futuras"
};

const PRIORITY_MAP = {
  Highest: "Highest",
  High: "High",
  Medium: "Medium",
  Low: "Lowest"
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    process.env[key] = val;
  }
}

function parseCsv(content) {
  const rows = [];
  let i = 0;
  const len = content.length;

  function readField() {
    let field = "";
    if (content[i] === '"') {
      i++;
      while (i < len) {
        if (content[i] === '"') {
          if (content[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += content[i++];
        }
      }
      if (content[i] === ",") i++;
      return field;
    }
    while (i < len && content[i] !== "," && content[i] !== "\n" && content[i] !== "\r") {
      field += content[i++];
    }
    if (content[i] === ",") i++;
    return field;
  }

  const headers = [];
  while (i < len && content[i] !== "\n" && content[i] !== "\r") {
    headers.push(readField());
  }
  if (content[i] === "\r") i++;
  if (content[i] === "\n") i++;

  while (i < len) {
    if (content[i] === "\r") {
      i++;
      continue;
    }
    if (content[i] === "\n") {
      i++;
      continue;
    }
    const row = {};
    for (const h of headers) {
      row[h] = readField();
    }
    if (Object.values(row).some((v) => v && String(v).trim())) rows.push(row);
    if (content[i] === "\r") i++;
    if (content[i] === "\n") i++;
  }
  return rows;
}

function env(name, required = false) {
  const v = process.env[name]?.trim();
  if (required && !v) {
    console.error(`Variável obrigatória ausente: ${name}`);
    console.error("Veja docs/jira-import/README.md e docs/jira-import/.env.example");
    process.exit(1);
  }
  return v ?? "";
}

function authHeader() {
  const email = env("JIRA_EMAIL", true);
  const token = env("JIRA_API_TOKEN", true);
  return `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}`;
}

async function jiraFetch(method, apiPath, body) {
  const base = env("JIRA_BASE_URL", true).replace(/\/$/, "");
  const res = await fetch(`${base}${apiPath}`, {
    method,
    headers: {
      Authorization: authHeader(),
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`Jira ${method} ${apiPath} → ${res.status}: ${text.slice(0, 500)}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

async function discover() {
  loadEnvFile(ENV_LOCAL);
  env("JIRA_BASE_URL", true);
  env("JIRA_EMAIL", true);
  env("JIRA_API_TOKEN", true);

  console.log("=== Campos Jira (Epic / Story Points) ===\n");
  const fields = await jiraFetch("GET", "/rest/api/3/field");
  for (const f of fields) {
    const n = (f.name || "").toLowerCase();
    if (
      n.includes("epic") ||
      n.includes("story point") ||
      n.includes("pontos") ||
      f.custom === true && (n.includes("link") || n.includes("epic"))
    ) {
      console.log(`${f.id}\t${f.name}\tcustom=${f.custom}`);
    }
  }

  const projectKey = env("JIRA_PROJECT_KEY") || "EXEQFISC";
  console.log(`\n=== Create meta — projeto ${projectKey} ===\n`);
  try {
    const meta = await jiraFetch(
      "GET",
      `/rest/api/3/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes.fields`
    );
    const project = meta.projects?.[0];
    if (!project) {
      console.log("Projeto não encontrado. Crie o projeto no Jira ou ajuste JIRA_PROJECT_KEY.");
      return;
    }
    console.log(`Projeto: ${project.name} (${project.key})`);
    for (const it of project.issuetypes || []) {
      console.log(`  Issue type: ${it.name} (id ${it.id})`);
    }
  } catch (e) {
    console.warn("createmeta:", e.message);
  }
}

function buildAdfDescription(text) {
  const lines = String(text || "").split(/\n/);
  const content = lines.map((line) => ({
    type: "paragraph",
    content: line ? [{ type: "text", text: line }] : []
  }));
  return { type: "doc", version: 1, content };
}

async function createIssue(fields, dryRun) {
  if (dryRun) {
    console.log("[dry-run] CREATE", fields.summary);
    return { key: "DRY-RUN", id: "0" };
  }
  return jiraFetch("POST", "/rest/api/3/issue", { fields });
}

async function importBacklog(dryRun) {
  loadEnvFile(ENV_LOCAL);
  const projectKey = env("JIRA_PROJECT_KEY", true);
  const epicLinkField = env("JIRA_EPIC_LINK_FIELD");
  const epicNameField = env("JIRA_EPIC_NAME_FIELD");
  const useParent = env("JIRA_USE_PARENT_EPIC") === "true";

  if (!fs.existsSync(CSV_PATH)) {
    console.error("CSV não encontrado:", CSV_PATH);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(CSV_PATH, "utf8"));
  const epicKeys = {};
  const epicNamesInCsv = [...new Set(rows.map((r) => r["Epic Name"]))];

  console.log(dryRun ? "\n=== DRY RUN (use --apply para criar) ===\n" : "\n=== IMPORTAÇÃO JIRA ===\n");
  console.log(`Projeto: ${projectKey} | Issues no CSV: ${rows.length} | Epics: ${epicNamesInCsv.length}\n`);

  // 1) Criar Epics
  for (const epicName of epicNamesInCsv) {
    const title = EPIC_TITLES[epicName] || epicName;
    const fields = {
      project: { key: projectKey },
      issuetype: { name: "Epic" },
      summary: `${epicName} — ${title}`,
      description: buildAdfDescription(
        `Epic importado do backlog SERPRO Fiscal.\nRepositório: cobranca-saas-api/docs/JIRA_PACOTE_SERPRO_FISCAL_MVP.md`
      )
    };
    if (epicNameField) {
      fields[epicNameField] = title;
    }
    const created = await createIssue(fields, dryRun);
    epicKeys[epicName] = created.key;
    console.log(`Epic ${epicName} → ${created.key}`);
    await sleep(300);
  }

  // 2) Criar Stories/Tasks/Spikes
  let ok = 0;
  let fail = 0;
  for (const row of rows) {
    const epicName = row["Epic Name"];
    const issueType = row["Issue Type"] || "Story";
    const summary = row.Summary || "Sem título";
    const description = row.Description || "";
    const storyPoints = Number(row["Story Points"]);
    const priorityName = PRIORITY_MAP[row.Priority] || "Medium";
    const labels = (row.Labels || "")
      .split(/\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    const components = (row.Components || "")
      .split(/[, ]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const fields = {
      project: { key: projectKey },
      issuetype: { name: issueType },
      summary,
      description: buildAdfDescription(
        `${description}\n\n---\nSprint alvo: ${row["Sprint Target"] || "—"}\nImport: docs/jira-import/JIRA_SERPRO_FISCAL_BACKLOG.csv`
      ),
      priority: { name: priorityName },
      labels
    };

    if (components.length) {
      fields.components = components.map((name) => ({ name }));
    }

    if (!Number.isNaN(storyPoints) && storyPoints > 0) {
      fields.customfield_10016 = storyPoints;
    }

    const epicKey = epicKeys[epicName];
    if (useParent && epicKey && epicKey !== "DRY-RUN") {
      fields.parent = { key: epicKey };
    } else if (epicLinkField && epicKey && epicKey !== "DRY-RUN") {
      fields[epicLinkField] = epicKey;
    }

    try {
      const created = await createIssue(fields, dryRun);
      console.log(`  ${created.key}  ${summary.slice(0, 60)}`);
      ok++;
    } catch (e) {
      fail++;
      console.error(`  ERRO  ${summary.slice(0, 50)}: ${e.message}`);
      if (e.status === 400 && String(e.message).includes("customfield")) {
        console.error("    → Rode --discover e ajuste JIRA_EPIC_LINK_FIELD / story points em .env.jira.local");
      }
    }
    await sleep(250);
  }

  console.log(`\nConcluído: ${ok} ok, ${fail} erros.`);
  if (dryRun) {
    console.log("\nNenhuma issue foi criada. Execute: node scripts/jira-import-backlog.mjs --apply");
  } else {
    console.log("\nPróximo passo: no Jira, criar Sprints S0–S10 e mover issues EXEQ-FISC-001…096 para Sprint 0.");
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const args = process.argv.slice(2);
if (args.includes("--discover")) {
  discover().catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else if (args.includes("--apply")) {
  importBacklog(false).catch((e) => {
    console.error(e);
    process.exit(1);
  });
} else {
  importBacklog(true).catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
