/**
 * EXEQ-FISC-021 — Homolog live SERPRO demo — piloto titular EXEQ (ricardo).
 *
 * Uso:
 *   FISCAL_SERPRO_MOCK=false FISCAL_SERPRO_REQUIRE_PROCURACAO=false npx tsx scripts/fisc-021-serpro-live-homolog.ts
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getPool, closePool } from "../src/platform/persistence/pool";
import { getOrganizationByAutomacaoTenantId } from "../src/modules/exeq-platform/infrastructure/organization-repository";
import { resolveSerproRuntimeForOrganization } from "../src/modules/fiscal-guias/application/resolve-serpro-runtime";
import {
  buildSerproConsultReciboRequest,
  buildSerproPgdasdTransmitRequest,
  serproTokenUrl
} from "../src/modules/serpro-integra-contador/infrastructure/serpro-request-builder";
import { parsePgdasdPedidoDados } from "../src/modules/serpro-integra-contador/domain/pgdasd-transmissao-payload";
import type { CanonicalApuracao } from "../src/modules/fiscal-ingestion/domain/canonical-apuracao.schema";
import { serproPgdasdTransmissaoOptionsFromEnv } from "../src/platform/config/fiscal-serpro-pgdasd";
import { getSerproAccessToken } from "../src/modules/serpro-integra-contador/infrastructure/serpro-oauth-token-cache";
import {
  decryptSerproConsumerKey,
  decryptSerproConsumerSecret,
  getSerproConfigByOrganizationId
} from "../src/modules/fiscal-guias/infrastructure/serpro-config-repository";
import { getActiveCertificadoForCliente } from "../src/modules/fiscal-guias/infrastructure/certificado-digital-repository";

const TENANT_ID = "8";
const PORTAL_CLIENTE_ID = "64219e1e-8488-4d9a-8d9f-b3a902835d1d";
const CLIENTE_CNPJ = "37229907000137";

type Step = {
  name: string;
  ok: boolean;
  detail?: string;
  statusCode?: number;
  bodyPreview?: string;
};

function preview(raw: unknown, max = 600): string {
  const s = typeof raw === "string" ? raw : JSON.stringify(raw);
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function isAuth403(bodyPreview: string): boolean {
  return bodyPreview.includes("jwt_token") || bodyPreview.includes("AcessoNegado");
}

function writeEvidence(payload: Record<string, unknown>): string {
  const dir = join(process.cwd(), "docs", "evidencias", "fisc-021");
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = join(dir, `fisc-021-serpro-live-ricardo-${stamp}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  return file;
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const live = process.env.FISCAL_SERPRO_MOCK?.trim().toLowerCase() === "false";
  process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO =
    process.env.FISCAL_SERPRO_REQUIRE_PROCURACAO?.trim() || "false";

  const steps: Step[] = [];
  const pool = getPool();
  const org = await getOrganizationByAutomacaoTenantId(pool, TENANT_ID);
  if (!org) {
    throw new Error("Organization ricardo nao encontrada.");
  }

  steps.push({
    name: "env_live_mode",
    ok: live,
    detail: live ? "FISCAL_SERPRO_MOCK=false" : "defina FISCAL_SERPRO_MOCK=false"
  });

  const serproConfig = await getSerproConfigByOrganizationId(pool, org.id);
  steps.push({
    name: "serpro_config_org",
    ok: Boolean(serproConfig?.serproEnabled && serproConfig.contratanteCnpj),
    detail: serproConfig
      ? `ambiente=${serproConfig.ambiente}; enabled=${serproConfig.serproEnabled}`
      : "ausente"
  });

  if (!live || !serproConfig?.serproEnabled) {
    const evidencePath = writeEvidence({ issue: "EXEQ-FISC-021", startedAt, steps });
    printReport(steps, evidencePath);
    await closePool();
    process.exit(1);
  }

  const consumerKey = decryptSerproConsumerKey(serproConfig);
  const consumerSecret = decryptSerproConsumerSecret(serproConfig);
  try {
    const oauth = await getSerproAccessToken({
      cacheKey: `fisc-021:${org.id}:${serproConfig.ambiente}`,
      tokenUrl: serproTokenUrl(serproConfig.ambiente),
      consumerKey: consumerKey!,
      consumerSecret: consumerSecret!
    });
    steps.push({
      name: "oauth_token",
      ok: Boolean(oauth?.trim()),
      detail: oauth ? `token_len=${oauth.length}` : "vazio"
    });
  } catch (error: unknown) {
    steps.push({
      name: "oauth_token",
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    });
  }

  try {
    const cert = await getActiveCertificadoForCliente(TENANT_ID, PORTAL_CLIENTE_ID);
    steps.push({
      name: "certificado_decrypt",
      ok: Boolean(cert?.decrypted.certificadoPem),
      detail: cert ? `${cert.label} valido ate ${cert.valid_until}` : "ausente"
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    steps.push({
      name: "certificado_decrypt",
      ok: false,
      detail: `${msg} — rode: npm run fisc-021:sync-cert (FISC_021_*_PEM_FILE)`
    });
  }

  let runtime: Awaited<ReturnType<typeof resolveSerproRuntimeForOrganization>>;
  try {
    runtime = await resolveSerproRuntimeForOrganization({
      organizationId: org.id,
      automacaoTenantId: TENANT_ID,
      portalClienteId: PORTAL_CLIENTE_ID,
      contribuinteCnpj: CLIENTE_CNPJ
    });
    steps.push({
      name: "resolve_runtime",
      ok: !runtime.useMock && Boolean(runtime.auth.jwtToken),
      detail: `useMock=${runtime.useMock}; jwt=${runtime.auth.jwtToken ? "ok" : "ausente"}; autor=${runtime.autorPedidoDocumento}`
    });
  } catch (error: unknown) {
    steps.push({
      name: "resolve_runtime",
      ok: false,
      detail: error instanceof Error ? error.message : String(error)
    });
    const evidencePath = writeEvidence({ issue: "EXEQ-FISC-021", startedAt, steps });
    printReport(steps, evidencePath);
    await closePool();
    process.exit(1);
  }

  const consultReq = buildSerproConsultReciboRequest({
    contratanteCnpj: runtime.contratanteCnpj,
    contribuinteCnpj: CLIENTE_CNPJ,
    autorPedidoDocumento: runtime.autorPedidoDocumento ?? CLIENTE_CNPJ,
    competencia: "2026-05",
    protocolo: undefined
  });
  const consultRes = await runtime.client.consultar(consultReq, runtime.auth);
  const consultPreview = preview(consultRes.rawBody);
  steps.push({
    name: "consultar_CONSDECREC15",
    ok: consultRes.ok || !isAuth403(consultPreview),
    statusCode: consultRes.statusCode,
    detail: consultRes.ok
      ? "ok"
      : isAuth403(consultPreview)
        ? "403 auth jwt_token"
        : `erro_negocio status=${consultRes.statusCode}`,
    bodyPreview: consultPreview
  });

  const liveApuracao: CanonicalApuracao = {
    cnpj: CLIENTE_CNPJ,
    competencia: "2024-01",
    receitaBrutaMes: 10000,
    regime: "SIMPLES",
    anexo: "ANEXO_III",
    tributos: { inss: 200, icms: 0, iss: 250, pisCofins: 50 },
    valorTotalDas: 500
  };

  const pgdasdOptions = serproPgdasdTransmissaoOptionsFromEnv();

  const declReq = buildSerproPgdasdTransmitRequest({
    contratanteCnpj: runtime.contratanteCnpj,
    contribuinteCnpj: CLIENTE_CNPJ,
    autorPedidoDocumento: runtime.autorPedidoDocumento ?? CLIENTE_CNPJ,
    apuracao: liveApuracao,
    pgdasdOptions
  });
  const declPayload = parsePgdasdPedidoDados(declReq.pedidoDados.dados);
  const declRes = await runtime.client.declarar(declReq, runtime.auth);
  const declPreview = preview(declRes.rawBody);
  const declAuthOk = declRes.ok || !isAuth403(declPreview);
  steps.push({
    name: "declarar_TRANSDECLARACAO11",
    ok: declAuthOk,
    statusCode: declRes.statusCode,
    detail: declRes.ok
      ? `protocolo=${declRes.protocolo ?? "—"}`
      : isAuth403(declPreview)
        ? "403 auth jwt_token"
        : `erro_negocio status=${declRes.statusCode}`,
    bodyPreview: declPreview,
    payloadKeys: Object.keys(declPayload).sort().join(","),
    indicadorTransmissao: declPayload.indicadorTransmissao
  });

  const dodAuth = steps.some((s) => s.name === "resolve_runtime" && s.ok) &&
    !steps.some((s) => s.detail?.includes("403 auth jwt_token"));
  const dodBusiness =
    steps.find((s) => s.name === "declarar_TRANSDECLARACAO11")?.ok === true;

  const evidencePath = writeEvidence({
    issue: process.env.FISCAL_SERPRO_PGDASD_SIMULAR?.trim().toLowerCase() === "true"
      ? "EXEQ-FISC-021b-sim"
      : "EXEQ-FISC-021",
    pilot: { tenant: "ricardo", cnpj: CLIENTE_CNPJ, modo: "titular" },
    startedAt,
    finishedAt: new Date().toISOString(),
    pgdasdOptions,
    dod: {
      sem_403_auth: dodAuth,
      transmissao_protocolo_ou_negocio: dodBusiness,
      procuracao_gate: "false (titular)"
    },
    steps
  });

  printReport(steps, evidencePath);
  await closePool();
  process.exit(dodAuth ? 0 : 1);
}

function printReport(steps: Step[], evidencePath: string): void {
  console.log("\n=== EXEQ-FISC-021 — SERPRO live titular ricardo ===\n");
  for (const s of steps) {
    console.log(`${s.ok ? "✓" : "✗"} ${s.name}${s.detail ? ` — ${s.detail}` : ""}`);
    if (s.bodyPreview && !s.ok) {
      console.log(`    ${s.bodyPreview.slice(0, 200)}`);
    }
  }
  console.log(`\nEvidência: ${evidencePath}`);
  const ok = steps.filter((s) => s.ok).length;
  console.log(`Resultado: ${ok}/${steps.length} OK`);
}

main().catch(async (err) => {
  console.error(err);
  await closePool().catch(() => undefined);
  process.exit(1);
});
