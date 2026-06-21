/**
 * Fábrica — verificação SERPRO tenant ricardo (ricardo@exeq.com.br).
 * Uso: npx tsx scripts/factory-serpro-ricardo-verify.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import request from "supertest";
import { createApp } from "../src/app";
import { processFiscalIngestValidateJob } from "../src/modules/fiscal-ingestion/application/process-fiscal-ingest-validate";
import { processSerproTransmitJob } from "../src/modules/fiscal-processamento/application/process-serpro-transmit-job";
import { processSerproReciboJob } from "../src/modules/fiscal-processamento/application/process-serpro-recibo-job";
import { processSerproEmitDasJob } from "../src/modules/fiscal-processamento/application/process-serpro-emit-das-job";
import { patchPortalSerproConfigUseCase } from "../src/modules/fiscal-guias/application/portal-serpro-config";
import { getPool, closePool } from "../src/platform/persistence/pool";

const TENANT_SLUG = "ricardo";
const TENANT_ID = "8";
const CLIENTE_ID = "64219e1e-8488-4d9a-8d9f-b3a902835d1d";
const CLIENTE_CNPJ = "37229907000137";
const LOGIN_EMAIL = "ricardo@exeq.com.br";
const LOGIN_PASSWORD = process.env.PORTAL_LOGIN_PASSWORD?.trim() || "TesteDev!2026";

type Step = { name: string; ok: boolean; detail?: string };

async function main(): Promise<void> {
  const steps: Step[] = [];
  process.env.FISCAL_GUIAS_ENABLED = "true";
  const live = process.env.FISCAL_SERPRO_MOCK?.trim().toLowerCase() === "false";
  if (!process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO?.trim()) {
    process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO = "false";
  }

  const pool = getPool();
  const consumerKey = process.env.SERPRO_CONSUMER_KEY?.trim();
  const consumerSecret = process.env.SERPRO_CONSUMER_SECRET?.trim();
  const contratante = process.env.SERPRO_CONTRATANTE_CNPJ?.trim() || CLIENTE_CNPJ;

  if (consumerKey && consumerSecret) {
    const patch = await patchPortalSerproConfigUseCase(pool, TENANT_ID, {
      ambiente: "demo",
      contratante_cnpj: contratante,
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      serpro_enabled: true
    });
    steps.push({
      name: "serpro_config_portal",
      ok: patch.ok,
      detail: patch.ok ? "gravado cifrado na org ricardo" : String((patch as { kind?: string }).kind)
    });
  } else {
    steps.push({ name: "serpro_config_portal", ok: false, detail: "SERPRO_CONSUMER_KEY/SECRET ausentes no .env" });
  }

  const app = createApp();
  const login = await request(app)
    .post("/v1/portal/auth/login")
    .send({ email: LOGIN_EMAIL, password: LOGIN_PASSWORD, tenant_id: TENANT_SLUG });
  steps.push({
    name: "login_ricardo",
    ok: login.status === 200 && Boolean(login.body.access_token),
    detail: `status=${login.status}`
  });
  if (login.status !== 200) {
    printReport(steps, live);
    process.exit(1);
  }

  const token = login.body.access_token as string;
  const auth = { Authorization: `Bearer ${token}`, "x-tenant-id": TENANT_SLUG };

  const cert = await request(app).get(`/v1/portal/fiscal/certificados?portal_cliente_id=${CLIENTE_ID}`).set(auth);
  steps.push({
    name: "certificado_a1_cliente",
    ok: cert.status === 200 && Boolean(cert.body.certificado?.id),
    detail: cert.body.certificado
      ? `${cert.body.certificado.label} valido ate ${cert.body.certificado.valid_until}`
      : `status=${cert.status}`
  });

  const serproCfg = await request(app).get("/v1/portal/fiscal/serpro-config").set(auth);
  steps.push({
    name: "serpro_config_leitura",
    ok: serproCfg.status === 200 && serproCfg.body.serpro_config?.serpro_enabled === true,
    detail: JSON.stringify({
      enabled: serproCfg.body.serpro_config?.serpro_enabled,
      key: serproCfg.body.serpro_config?.consumer_key_configured,
      cnpj: serproCfg.body.serpro_config?.contratante_cnpj
    })
  });

  const offset = Math.floor(Date.now() / 1000) % 36;
  const d = new Date();
  d.setMonth(d.getMonth() - offset - 1);
  const competencia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const template = readFileSync(join(process.cwd(), "docs/templates/pgdasd-import-v1.csv"), "utf8");
  const csvLines = template.trimEnd().split(/\r?\n/);
  const cols = csvLines[1]!.split(",");
  cols[0] = CLIENTE_CNPJ;
  cols[1] = competencia;
  const csv = `${csvLines[0]}\n${cols.join(",")}\n`;

  const ingest = await request(app)
    .post("/v1/portal/fiscal/ingest/csv")
    .set(auth)
    .attach("file", Buffer.from(csv, "utf8"), `pgdasd-ricardo-${competencia}.csv`);
  steps.push({ name: "csv_ingest_upload", ok: ingest.status === 202, detail: `status=${ingest.status}` });

  if (ingest.status !== 202) {
    printReport(steps, live);
    await closePool();
    process.exit(1);
  }

  const ingestId = ingest.body.ingest.id as string;
  await processFiscalIngestValidateJob({ ingestId, automacaoTenantId: TENANT_ID });
  const ingestGet = await request(app).get(`/v1/portal/fiscal/ingest/${ingestId}`).set(auth);
  steps.push({
    name: "csv_ingest_validado",
    ok: ingestGet.body.ingest?.status === "VALIDADO",
    detail: ingestGet.body.ingest?.status
  });

  const proc = await request(app)
    .post("/v1/portal/fiscal/processamentos")
    .set(auth)
    .send({ fiscal_ingest_id: ingestId });
  const processamentoId = proc.body.processamentos?.[0]?.id as string | undefined;
  steps.push({
    name: "processamento_criado",
    ok: proc.status === 201 && Boolean(processamentoId),
    detail: processamentoId ?? `status=${proc.status}`
  });

  if (processamentoId) {
    await processSerproTransmitJob({ processamentoId, automacaoTenantId: TENANT_ID });
    await processSerproReciboJob({ processamentoId, automacaoTenantId: TENANT_ID });
    await processSerproEmitDasJob({ processamentoId, automacaoTenantId: TENANT_ID });
    const detail = await request(app).get(`/v1/portal/fiscal/processamentos/${processamentoId}`).set(auth);
    const p = detail.body.processamento;
    const eventos = (detail.body.eventos ?? []) as Array<{ evento: string }>;
    const hasRecibo = eventos.some((e) => e.evento === "recibo_concluido");
    const hasDas = eventos.some((e) => e.evento === "das_concluido");
    const pipelineOk = p?.status === "CONCLUIDO" || (hasRecibo && hasDas);
    steps.push({
      name: "pipeline_serpro_concluido",
      ok: pipelineOk,
      detail: `status=${p?.status}; protocolo=${p?.protocolo_serpro ?? "—"}; recibo=${hasRecibo}; das=${hasDas}; live=${live}`
    });
    if (!live && p?.status === "ERRO") {
      const errEv = eventos.find((e) => e.evento === "transmissao_erro" || e.evento === "das_erro");
      if (errEv) {
        steps.push({ name: "pipeline_erro_detalhe", ok: false, detail: errEv.evento });
      }
    }
    if (live && p?.status === "ERRO") {
      steps.push({
        name: "live_serpro_erro",
        ok: false,
        detail: `status=${p?.status}; erro=${p?.erro_codigo ?? "—"}; ver eventos transmissao_erro/recibo_erro/das_erro`
      });
    }
  }

  printReport(steps, live);
  await closePool();
  process.exit(steps.every((s) => s.ok) ? 0 : 1);
}

function printReport(steps: Step[], live: boolean): void {
  console.log("\n=== Fábrica SERPRO — escritório ricardo ===");
  console.log(`Modo API: ${live ? "LIVE demo SERPRO" : "MOCK (FISCAL_SERPRO_MOCK≠false)"}`);
  console.log(`Login: ${LOGIN_EMAIL} | tenant: ${TENANT_SLUG}`);
  console.log(`Cliente: EXEQ TECNOLOGIA (${CLIENTE_CNPJ})\n`);
  for (const s of steps) {
    console.log(`${s.ok ? "✓" : "✗"} ${s.name}${s.detail ? ` — ${s.detail}` : ""}`);
  }
  const ok = steps.filter((s) => s.ok).length;
  console.log(`\nResultado: ${ok}/${steps.length} OK`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
