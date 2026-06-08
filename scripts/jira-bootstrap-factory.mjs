#!/usr/bin/env node
/**
 * Bootstrap projeto Jira EXEQFISC + components + import backlog + board hints.
 *
 * Uso:
 *   node scripts/jira-bootstrap-factory.mjs --check
 *   node scripts/jira-bootstrap-factory.mjs --create-project
 *   node scripts/jira-bootstrap-factory.mjs --full
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_LOCAL = path.join(ROOT, "docs/jira-import/.env.jira.local");

const COMPONENTS = ["backend", "frontend", "database", "devops", "ux-ui", "qa", "architecture", "pm"];

const PROJECT = {
  key: process.env.JIRA_PROJECT_KEY || "EXEQSRP",
  name: process.env.JIRA_PROJECT_NAME || "Exeq SERPRO",
  description: "Automacao fiscal SERPRO PGDASD DAS — MVP Fase 1. Backlog: docs/JIRA_PACOTE_SERPRO_FISCAL_MVP.md"
};

function loadEnv() {
  if (!fs.existsSync(ENV_LOCAL)) {
    console.error("Crie docs/jira-import/.env.jira.local — veja .env.example");
    process.exit(1);
  }
  for (const line of fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

function authHeaders(json = true) {
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const h = { Authorization: `Basic ${auth}`, Accept: "application/json" };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function baseUrl() {
  return process.env.JIRA_BASE_URL.replace(/\/$/, "");
}

async function jira(method, apiPath, body) {
  const res = await fetch(`${baseUrl()}${apiPath}`, {
    method,
    headers: authHeaders(body !== undefined),
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json, text };
}

async function listProjects() {
  const r = await jira("GET", "/rest/api/3/project/search?maxResults=50");
  return r.ok ? r.json.values || [] : [];
}

async function getProject(key) {
  const r = await jira("GET", `/rest/api/3/project/${key}`);
  return r.ok ? r.json : null;
}

async function resolveAccountId() {
  const email = process.env.JIRA_EMAIL;
  for (const q of [email, email.split("@")[0]]) {
    const r = await jira("GET", `/rest/api/3/user/search?query=${encodeURIComponent(q)}&maxResults=5`);
    if (r.ok && r.json.length) return r.json[0].accountId;
  }
  const r2 = await jira("GET", "/rest/api/3/mypreferences?key=jira.user.locale");
  if (r2.ok && r2.json?.accountId) return r2.json.accountId;
  return null;
}

async function createProjectCompanyManaged(leadAccountId) {
  return jira("POST", "/rest/api/3/project", {
    key: PROJECT.key,
    name: PROJECT.name,
    projectTypeKey: "software",
    projectTemplateKey: "com.pyxis.greenhopper.jira:gh-scrum-template",
    description: PROJECT.description,
    leadAccountId,
    assigneeType: "PROJECT_LEAD"
  });
}

async function createProjectTeamManaged() {
  return jira("POST", "/rest/simplified/1.0/projects", {
    key: PROJECT.key,
    name: PROJECT.name,
    template: "SCRUM"
  });
}

async function createProjectLegacy() {
  return jira("POST", "/rest/simplified/latest/project", {
    key: PROJECT.key,
    name: PROJECT.name,
    projectTypeKey: "software",
    templateKey: "com.pyxis.greenhopper.jira:gh-scrum-template"
  });
}

async function ensureComponents(projectKey) {
  const existing = await jira("GET", `/rest/api/3/project/${projectKey}/components`);
  const names = new Set((existing.ok ? existing.json : []).map((c) => c.name));
  const created = [];
  for (const name of COMPONENTS) {
    if (names.has(name)) continue;
    const r = await jira("POST", "/rest/api/3/component", {
      name,
      project: projectKey,
      description: `Component ${name} — Exeq Fiscal SERPRO`
    });
    if (r.ok) created.push(name);
    else console.warn(`  component ${name}: ${r.status}`, r.text.slice(0, 120));
    await sleep(200);
  }
  return created;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runImport() {
  const r = spawnSync(process.execPath, [path.join(ROOT, "scripts/jira-import-backlog.mjs"), "--apply"], {
    cwd: ROOT,
    stdio: "inherit",
    env: process.env
  });
  return r.status === 0;
}

async function main() {
  loadEnv();
  const check = process.argv.includes("--check");
  const createOnly = process.argv.includes("--create-project");
  const full = process.argv.includes("--full");

  console.log("Jira bootstrap —", baseUrl());
  console.log("Projeto alvo:", PROJECT.key, "—", PROJECT.name, "\n");

  const projects = await listProjects();
  console.log(`Projetos visíveis: ${projects.length}`);
  projects.forEach((p) => console.log(`  ${p.key} — ${p.name}`));

  let project = await getProject(PROJECT.key);

  if (!project && (createOnly || full)) {
    console.log("\nCriando projeto…");
    const leadId = await resolveAccountId();
    console.log("Account ID lead:", leadId || "(não resolvido — tentando sem lead)");

    const attempts = [];
    if (leadId) attempts.push(() => createProjectCompanyManaged(leadId));
    attempts.push(() => createProjectTeamManaged(), () => createProjectLegacy());

    for (const fn of attempts) {
      const r = await fn();
      console.log("  tentativa:", r.status, r.text.slice(0, 200));
      if (r.ok) {
        project = r.json;
        break;
      }
    }
    project = project || (await getProject(PROJECT.key));
  }

  if (!project) {
    console.error("\nProjeto", PROJECT.key, "não existe ou sem permissão de criação.");
    console.error("Ação manual (5 min): https://exeq.atlassian.net → Create project → Scrum → Key EXEQFISC");
    console.error("Depois: node scripts/jira-bootstrap-factory.mjs --full");
    process.exit(1);
  }

  console.log("\nProjeto OK:", project.key, project.name);

  if (check) {
    console.log("\n--check concluído.");
    return;
  }

  console.log("\nComponents…");
  const created = await ensureComponents(PROJECT.key);
  console.log(created.length ? `  criados: ${created.join(", ")}` : "  todos já existiam");

  if (createOnly) {
    console.log("\nProjeto pronto. Rode --full para importar backlog.");
    return;
  }

  if (full) {
    console.log("\nImportando backlog (58 issues)…");
    const ok = await runImport();
    if (!ok) process.exit(1);
    console.log("\n=== Bootstrap concluído ===");
    console.log("Manual Jira UI:");
    console.log("  1. Board → Create Sprint 'S0 — Discovery SERPRO'");
    console.log("  2. Mover EXEQ-FISC-001..004, 096 para S0");
    console.log("  3. PO: docs/AUTORIZACAO_PO_FABRICA_EXECUCAO_IMEDIATA.md");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
