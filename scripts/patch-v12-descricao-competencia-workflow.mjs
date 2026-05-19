/**
 * Aplica V12 (descrição × competência) em workflows/Emissor_NF_V12_Descricao_Competencia.json
 * Uso: node scripts/patch-v12-descricao-competencia-workflow.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const wfPath = path.join(root, "workflows", "Emissor_NF_V12_Descricao_Competencia.json");

const data = JSON.parse(fs.readFileSync(wfPath, "utf8"));

data.name = "Emissor NF - V12 Descrição × Competência (RTC + V11 base)";
data.meta = {
  ...(data.meta || {}),
  workflow_revision: "v12-descricao-competencia",
  workflow_revision_note:
    "V12: validação opcional descrição vs competência (off|warn|block) por tenant. Default off = homologação V11 inalterada."
};

const resolver = data.nodes.find((n) => n.name === "Resolver Tenant SaaS");
if (!resolver?.parameters?.query) throw new Error("Resolver Tenant SaaS não encontrado");
let rq = resolver.parameters.query;
if (!rq.includes("descricao_competencia_check")) {
  const old = "AS fiscal_corretora_perfil_padrao\n\nFROM src";
  const neu =
    "AS fiscal_corretora_perfil_padrao,\n  COALESCE(t.descricao_competencia_check, 'off') AS descricao_competencia_check\n\nFROM src";
  if (!rq.includes(old)) throw new Error("Trecho Resolver inesperado (perfil_padrao/FROM)");
  rq = rq.replace(old, neu);
  resolver.parameters.query = rq;
}

const salvar = data.nodes.find((n) => n.name === "Salvar Solicitacao NF");
if (!salvar?.parameters?.query) throw new Error("Salvar Solicitacao NF não encontrado");
if (!salvar.parameters.query.includes("descricao_competencia_aviso")) {
  const marker = "servico_padrao: $json.servico_padrao || \"\"";
  if (!salvar.parameters.query.includes(marker)) throw new Error("marker Salvar não encontrado");
  salvar.parameters.query = salvar.parameters.query.replace(
    marker,
    "servico_padrao: $json.servico_padrao || \"\",\n    descricao_competencia_aviso: $json.descricao_competencia_aviso || \"\""
  );
}

const CODE_ID = "b8c9d0e1-v12a-4001-8001-000000000001";
const IF_ID = "b8c9d0e1-v12a-4002-8002-000000000002";

const codePath = path.join(__dirname, "v12-descricao-competencia-n8n.js");
const jsCode = fs.readFileSync(codePath, "utf8");

const codeNode = {
  parameters: { jsCode },
  id: CODE_ID,
  name: "V12 | Descrição x Competência",
  type: "n8n-nodes-base.code",
  typeVersion: 2,
  position: [-1520, 320]
};

const ifNode = {
  parameters: {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: "",
        typeValidation: "strict",
        version: 1
      },
      conditions: [
        {
          id: "v12-bloqueio-desc",
          leftValue: "={{ $json.descricao_competencia_bloqueio === true }}",
          rightValue: "",
          operator: { type: "boolean", operation: "true", singleValue: true }
        }
      ],
      combinator: "and"
    },
    options: {}
  },
  id: IF_ID,
  name: "V12 | Descrição bloqueia emissão?",
  type: "n8n-nodes-base.if",
  typeVersion: 2,
  position: [-1360, 320]
};

const existing = new Set(data.nodes.map((n) => n.id));
if (!existing.has(CODE_ID)) {
  const idx = data.nodes.findIndex((n) => n.name === "Preparar Ref NF");
  if (idx < 0) throw new Error("Preparar Ref NF não encontrado");
  data.nodes.splice(idx + 1, 0, codeNode, ifNode);
}

data.connections["Preparar Ref NF"] = {
  main: [[{ node: "V12 | Descrição x Competência", type: "main", index: 0 }]]
};
data.connections["V12 | Descrição x Competência"] = {
  main: [[{ node: "V12 | Descrição bloqueia emissão?", type: "main", index: 0 }]]
};
data.connections["V12 | Descrição bloqueia emissão?"] = {
  main: [
    [{ node: "Preparar Envio NF Cliente", type: "main", index: 0 }],
    [{ node: "Salvar Solicitacao NF", type: "main", index: 0 }]
  ]
};

fs.writeFileSync(wfPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("OK:", wfPath);
