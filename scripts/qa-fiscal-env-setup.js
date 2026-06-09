const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const portalPath = path.join(root, "apps", "portal-web", ".env.local");

const fiscalBlock = [
  "",
  "# --- QA Fiscal Fase 2 (Perfil A stub) - configurado DevOps ---",
  "FISCAL_GUIAS_ENABLED=true",
  "FISCAL_CAPTURE_STUB=true",
  "FISCAL_PDF_STORAGE=local",
  "FISCAL_PDF_LOCAL_DIR=./data/fiscal-homolog-e2e"
].join("\n");

let env = fs.readFileSync(envPath, "utf8");
if (!/FISCAL_GUIAS_ENABLED=/.test(env)) {
  env = env.trimEnd() + fiscalBlock + "\n";
  console.log("[.env] fiscal flags adicionadas");
} else {
  env = env
    .replace(/FISCAL_GUIAS_ENABLED=.*/g, "FISCAL_GUIAS_ENABLED=true")
    .replace(/FISCAL_CAPTURE_STUB=.*/g, "FISCAL_CAPTURE_STUB=true");
  if (!/FISCAL_PDF_STORAGE=/.test(env)) {
    env = env.trimEnd() + "\nFISCAL_PDF_STORAGE=local\nFISCAL_PDF_LOCAL_DIR=./data/fiscal-homolog-e2e\n";
  }
  console.log("[.env] fiscal flags atualizadas");
}
fs.writeFileSync(envPath, env);

let plContent = "";
try {
  plContent = fs.readFileSync(portalPath, "utf8");
} catch {
  plContent = "";
}
if (!/VITE_FISCAL_GUIAS_ENABLED=true/.test(plContent)) {
  plContent = `${plContent.trimEnd()}\n\n# QA Fiscal Fase 2\nVITE_FISCAL_GUIAS_ENABLED=true\n`.trimStart();
  fs.writeFileSync(portalPath, plContent);
  console.log("[portal] VITE_FISCAL_GUIAS_ENABLED=true");
} else {
  console.log("[portal] flag fiscal ja presente");
}
