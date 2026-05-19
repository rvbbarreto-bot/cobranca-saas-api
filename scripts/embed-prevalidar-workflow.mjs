/**
 * Copia workflows/snippets/pre-validar-focus1-extracted.js para o nó
 * "AJUSTE SÊNIOR | Pré-validar Payload Focus1" em Emissor_NF_V10_RTC_Fiscal.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const workflowPath = path.join(root, "workflows", "Emissor_NF_V10_RTC_Fiscal.json");
const snippetPath = path.join(root, "workflows", "snippets", "pre-validar-focus1-extracted.js");

const data = JSON.parse(fs.readFileSync(workflowPath, "utf8"));
const node = data.nodes.find((n) => n.name === "AJUSTE SÊNIOR | Pré-validar Payload Focus1");
if (!node?.parameters) {
  throw new Error("Nó Pré-validar Focus1 não encontrado");
}
node.parameters.jsCode = fs.readFileSync(snippetPath, "utf8");
fs.writeFileSync(workflowPath, JSON.stringify(data, null, 2) + "\n", "utf8");
console.log("[embed-prevalidar] OK:", workflowPath);
