/**
 * Injeta colunas fiscais no SQL do Resolver, nó Code "Fiscal | Motor seguro (RTC)"
 * e reconecta Salvar -> Fiscal -> Pré-validar.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const workflowPath = path.join(root, "workflows", "Emissor_NF_V10_RTC_Fiscal.json");
const snippetPath = path.join(root, "workflows", "snippets", "fiscal-motor-seguro-v1.js");

const jsCode = fs.readFileSync(snippetPath, "utf8");
const data = JSON.parse(fs.readFileSync(workflowPath, "utf8"));

data.name = "Emissor NF - V10 RTC Fiscal";

const fiscalNode = {
  parameters: { jsCode },
  id: "f1e2d3c4-b5a6-4789-9012-3456789abcde",
  name: "Fiscal | Motor seguro (RTC)",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [-1408, 256]
};

const resolver = data.nodes.find((n) => n.name === "Resolver Tenant SaaS");
if (!resolver?.parameters?.query) {
  throw new Error("Resolver Tenant SaaS não encontrado");
}

const q = resolver.parameters.query;
const needle = "COALESCE(t.tipo_emissao_nfse, 'municipal') AS tipo_emissao_nfse\n\nFROM src";
const insert = `COALESCE(t.tipo_emissao_nfse, 'municipal') AS tipo_emissao_nfse,

  COALESCE(t.fiscal_engine_enabled, false) AS fiscal_engine_enabled,
  COALESCE(t.fiscal_force_legacy_only, true) AS fiscal_force_legacy_only,
  t.rtc_declarative_effective_from::text AS rtc_declarative_effective_from,
  NULLIF(trim(t.rtc_cbs_rate::text), '') AS rtc_cbs_rate,
  NULLIF(trim(t.rtc_ibs_rate::text), '') AS rtc_ibs_rate

FROM src`;
if (!q.includes(needle)) {
  throw new Error("Trecho esperado do SQL do Resolver não encontrado (workflow já patchado ou divergente?)");
}
resolver.parameters.query = q.replace(needle, insert);

const salvarIdx = data.nodes.findIndex((n) => n.name === "Salvar Solicitacao NF");
if (salvarIdx < 0) throw new Error("Salvar Solicitacao NF não encontrado");
if (data.nodes.some((n) => n.name === fiscalNode.name)) {
  console.log("[patch] Nó fiscal já existe; abortando duplicata.");
} else {
  data.nodes.splice(salvarIdx + 1, 0, fiscalNode);
}

const preValidar = "AJUSTE SÊNIOR | Pré-validar Payload Focus1";
if (!data.connections["Salvar Solicitacao NF"]?.main?.[0]?.[0]) {
  throw new Error("connections Salvar Solicitacao NF inválido");
}

data.connections["Salvar Solicitacao NF"] = {
  main: [[{ node: fiscalNode.name, type: "main", index: 0 }]]
};

data.connections[fiscalNode.name] = {
  main: [[{ node: preValidar, type: "main", index: 0 }]]
};

fs.writeFileSync(workflowPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("[patch] OK:", workflowPath);
