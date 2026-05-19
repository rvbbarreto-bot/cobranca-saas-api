import fs from "node:fs";
import path from "node:url";
import pathMod from "node:path";

const __dirname = pathMod.dirname(pathMod.fileURLToPath(import.meta.url));
const src = pathMod.join(__dirname, "..", "workflows", "snippets", "fiscal-motor-seguro-v1.js");
const out = pathMod.join(__dirname, "..", "workflows", "snippets", "fiscal-motor-seguro-v1.escaped.json");
const s = fs.readFileSync(src, "utf8");
fs.writeFileSync(out, JSON.stringify(s), "utf8");
console.log("Wrote", out, "length", JSON.stringify(s).length);
