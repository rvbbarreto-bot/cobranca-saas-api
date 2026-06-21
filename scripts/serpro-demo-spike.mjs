#!/usr/bin/env node
/**
 * EXEQ-FISC-001 — Spike SERPRO Integra Contador (demo)
 *
 * Uso:
 *   node scripts/serpro-demo-spike.mjs --dry-run
 *   node scripts/serpro-demo-spike.mjs   # requer .env.serpro.local
 *
 * Evidência: docs/evidencias/sprint-0/serpro-spike-<timestamp>.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serproHttpsRequest } from "./lib/serpro-https-fetch.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ENV_SERPRO = path.join(ROOT, ".env.serpro.local");
const ENV_ROOT = path.join(ROOT, ".env");
const EVIDENCE_DIR = path.join(ROOT, "docs/evidencias/sprint-0");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
}

function writeEvidence(payload) {
  if (!fs.existsSync(EVIDENCE_DIR)) fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(EVIDENCE_DIR, `serpro-spike-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  console.log("Evidência:", file);
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  loadEnv(ENV_ROOT);
  loadEnv(ENV_SERPRO);

  const base = (process.env.SERPRO_BASE_URL || "https://gateway.apiserpro.serpro.gov.br").replace(/\/$/, "");
  const consumerKey = process.env.SERPRO_CONSUMER_KEY;
  const consumerSecret = process.env.SERPRO_CONSUMER_SECRET;
  const contratanteCnpj = process.env.SERPRO_CONTRATANTE_CNPJ || "00000000000000";

  const evidence = {
    sprint: "S0",
    issue: "EXEQ-FISC-001",
    mode: dryRun ? "dry-run" : "live",
    timestamp: new Date().toISOString(),
    steps: []
  };

  if (dryRun) {
    evidence.steps.push({
      step: "dry-run",
      message: "Spike preparado. Configure .env.serpro.local e rode sem --dry-run.",
      pedidoDados: {
        idSistema: "PGDASD",
        idServico: "CONSULTIMADECREC14",
        versaoSistema: "1.0",
        nota: "Consultar última declaração/recibo transmitida"
      },
      envExample: ".env.serpro.local — SERPRO_CONSUMER_KEY, SERPRO_CONSUMER_SECRET, SERPRO_CONTRATANTE_CNPJ"
    });
    writeEvidence(evidence);
    console.log("Dry-run OK. Próximo: credenciais Loja SERPRO + execução live.");
    return;
  }

  if (!consumerKey || !consumerSecret) {
    evidence.steps.push({ step: "auth", error: "SERPRO_CONSUMER_KEY/SECRET ausentes em .env.serpro.local" });
    writeEvidence(evidence);
    console.error("Configure .env.serpro.local (veja docs/SERPRO_HOMOLOG_CHECKLIST.md)");
    process.exit(1);
  }

  // OAuth2 client credentials — Loja SERPRO usa POST {base}/token
  const tokenUrl = `${base}/token`;
  const basic = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

  try {
    const tokenRes = await serproHttpsRequest(tokenUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    const tokenText = await tokenRes.text();
    evidence.steps.push({
      step: "oauth",
      status: tokenRes.status,
      bodyPreview: tokenText.includes("access_token")
        ? tokenText.replace(/"access_token"\s*:\s*"[^"]+"/, '"access_token":"***"')
        : tokenText.slice(0, 500)
    });

    if (!tokenRes.ok) {
      writeEvidence(evidence);
      process.exit(1);
    }

    const { access_token: accessToken } = JSON.parse(tokenText);

    // Body Integra Contador — CONSULTIMADECREC14 (parâmetros mínimos demo)
    const dadosInner = JSON.stringify({ pa: "202605" });
    const body = {
      contratante: { numero: contratanteCnpj.replace(/\D/g, ""), tipo: 2 },
      autorPedidoDados: { numero: contratanteCnpj.replace(/\D/g, ""), tipo: 2 },
      contribuinte: { numero: contratanteCnpj.replace(/\D/g, ""), tipo: 2 },
      pedidoDados: {
        idSistema: "PGDASD",
        idServico: "CONSULTIMADECREC14",
        versaoSistema: "1.0",
        dados: dadosInner
      }
    };

    const apiPath = `${base}/integra-contador/v1/Consultar`;
    const apiRes = await serproHttpsRequest(apiPath, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    const apiText = await apiRes.text();
    evidence.steps.push({
      step: "CONSULTIMADECREC14",
      url: apiPath,
      status: apiRes.status,
      bodyPreview: apiText.slice(0, 1000)
    });

    writeEvidence(evidence);
    if (tokenRes.ok && !apiRes.ok && apiText.includes("jwt_token")) {
      console.log(
        "Spike FISC-001 OK — OAuth SERPRO validado. Consulta retornou HTTP",
        apiRes.status,
        "(Integra Contador exige header jwt_token com certificado/procurador — proximo passo no pipeline)."
      );
      process.exit(0);
    }
    console.log(apiRes.ok ? "Spike live OK (ver evidência)." : "Spike live falhou (ver evidência).");
    process.exit(apiRes.ok ? 0 : 1);
  } catch (err) {
    const cause = err?.cause;
    const detail =
      cause && typeof cause === "object" && "code" in cause
        ? `${err.message} (${cause.code})`
        : err.message;
    evidence.steps.push({
      step: "error",
      message: detail,
      hint:
        cause?.code === "UND_ERR_CONNECT_TIMEOUT"
          ? "Gateway SERPRO lento (>10s). Use SERPRO_CONNECT_TIMEOUT_MS=60000 (corrigido no script)."
          : undefined
    });
    writeEvidence(evidence);
    console.error(detail);
    process.exit(1);
  }
}

main();
