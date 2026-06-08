#!/usr/bin/env node
/**
 * Teste de conexão Jira — lê credenciais de docs/jira-import/.env.jira.local
 * Uso: node scripts/jira-test-connection.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_LOCAL = path.join(ROOT, "docs/jira-import/.env.jira.local");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error("Arquivo não encontrado:", filePath);
    console.error("Copie docs/jira-import/.env.example → .env.jira.local e preencha.");
    process.exit(1);
  }
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    process.env[k] = v;
  }
}

async function main() {
  loadEnvFile(ENV_LOCAL);
  const base = (process.env.JIRA_BASE_URL || "").replace(/\/$/, "");
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!base || !email || !token) {
    console.error("Preencha JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN em .env.jira.local");
    process.exit(1);
  }

  const auth = Buffer.from(`${email}:${token}`).toString("base64");
  const res = await fetch(`${base}/rest/api/3/project`, {
    headers: { Authorization: `Basic ${auth}`, Accept: "application/json" }
  });
  const text = await res.text();
  if (!res.ok) {
    console.error("Falha:", res.status, text.slice(0, 400));
    process.exit(1);
  }
  const projects = JSON.parse(text);
  console.log("Conexão OK — projetos visíveis para esta conta:\n");
  for (const p of projects) {
    console.log(`  ${p.key}\t${p.name}\t(${p.projectTypeKey})`);
  }
  console.log(`\nTotal: ${projects.length}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
