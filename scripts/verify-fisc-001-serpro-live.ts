/**
 * EXEQ-FISC-001 — readiness credenciais SERPRO live (sem secrets no output).
 * Uso: npm run verify:fisc-001
 *
 * Variáveis:
 * - DATABASE_URL (obrigatório)
 * - FISC_001_ORGANIZATION_ID (opcional — UUID org piloto; senão lista todas)
 * - FISCAL_SERPRO_MOCK (deve ser false para go-live live)
 */
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { mapSerproConfigPublic } from "../src/modules/fiscal-guias/infrastructure/serpro-config-repository";

type OrgReadiness = {
  organization_id: string;
  slug: string | null;
  serpro_config: ReturnType<typeof mapSerproConfigPublic> | null;
  ready: boolean;
  blockers: string[];
};

function isTruthyFlag(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "true" || v === "1";
}

function evaluateOrg(row: {
  organization_id: string;
  slug: string | null;
  ambiente: string | null;
  contratante_cnpj: string | null;
  consumer_key_encrypted: string | null;
  consumer_secret_encrypted: string | null;
  serpro_enabled: boolean | null;
  updated_at: Date | null;
}): OrgReadiness {
  const blockers: string[] = [];
  if (!row.ambiente) {
    blockers.push("serpro_config ausente — configure via portal Config Fiscal");
  } else {
    if (row.ambiente !== "prod") {
      blockers.push(`ambiente=${row.ambiente} — live exige ambiente prod`);
    }
    if (!row.serpro_enabled) {
      blockers.push("serpro_enabled=false na org");
    }
    if (!row.consumer_key_encrypted?.trim()) {
      blockers.push("consumer_key nao configurada");
    }
    if (!row.consumer_secret_encrypted?.trim()) {
      blockers.push("consumer_secret nao configurado");
    }
    if (!row.contratante_cnpj?.trim()) {
      blockers.push("CNPJ contratante ausente");
    }
  }

  const publicConfig = row.ambiente
    ? mapSerproConfigPublic({
        id: "",
        organizationId: row.organization_id,
        ambiente: row.ambiente as "demo" | "prod",
        contratanteCnpj: row.contratante_cnpj ?? "",
        consumerKeyEncrypted: row.consumer_key_encrypted,
        consumerSecretEncrypted: row.consumer_secret_encrypted,
        encryptionIv: "",
        consumerSecretIv: null,
        serproEnabled: row.serpro_enabled ?? false,
        updatedAt: row.updated_at?.toISOString() ?? new Date(0).toISOString()
      })
    : null;

  return {
    organization_id: row.organization_id,
    slug: row.slug,
    serpro_config: publicConfig,
    ready: blockers.length === 0,
    blockers
  };
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();
  const dbUrl = process.env.DATABASE_URL?.trim();
  if (!dbUrl) {
    throw new Error("DATABASE_URL ausente.");
  }

  const envIssues: string[] = [];
  if (isTruthyFlag(process.env.FISCAL_SERPRO_MOCK)) {
    envIssues.push("FISCAL_SERPRO_MOCK=true — desligue para live SERPRO");
  }
  if (!process.env.ENCRYPTION_KEY?.trim()) {
    envIssues.push("ENCRYPTION_KEY ausente — necessaria para credenciais por org");
  }

  const orgFilter = process.env.FISC_001_ORGANIZATION_ID?.trim();
  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  const r = await client.query<{
    organization_id: string;
    slug: string | null;
    ambiente: string | null;
    contratante_cnpj: string | null;
    consumer_key_encrypted: string | null;
    consumer_secret_encrypted: string | null;
    serpro_enabled: boolean | null;
    updated_at: Date | null;
  }>(
    `SELECT
       o.id::text AS organization_id,
       o.slug,
       ot.automacao_tenant_id,
       sc.ambiente,
       sc.contratante_cnpj,
       sc.consumer_key_encrypted,
       sc.consumer_secret_encrypted,
       sc.serpro_enabled,
       sc.updated_at
     FROM portal.organization o
     LEFT JOIN portal.organization_tenant ot ON ot.organization_id = o.id
     LEFT JOIN fiscal.serpro_config sc ON sc.organization_id = o.id
     ${orgFilter ? "WHERE o.id = $1::uuid" : ""}
     ORDER BY o.created_at ASC`,
    orgFilter ? [orgFilter] : []
  );

  await client.end();

  const orgs = r.rows.map(evaluateOrg);
  const readyCount = orgs.filter((o) => o.ready).length;

  const evidenceDir = join(process.cwd(), "docs/evidencias/fisc-001");
  mkdirSync(evidenceDir, { recursive: true });
  const evidencePath = join(evidenceDir, `fisc-001-readiness-${startedAt.replace(/[:.]/g, "-")}.json`);
  writeFileSync(
    evidencePath,
    JSON.stringify(
      {
        issue: "EXEQ-FISC-001",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        env_issues: envIssues,
        organizations_checked: orgs.length,
        organizations_ready: readyCount,
        organizations: orgs,
        po_doc: "docs/FISC-001_SERPRO_CREDENCIAIS_LIVE.md"
      },
      null,
      2
    )
  );

  console.log(`[fisc-001] Organizacoes verificadas: ${orgs.length}, prontas: ${readyCount}`);
  console.log(`[fisc-001] Evidencia: ${evidencePath}`);

  for (const org of orgs) {
    if (!org.ready) {
      console.log(`[fisc-001] BLOCK org=${org.organization_id} slug=${org.slug ?? "—"}`);
      for (const b of org.blockers) console.log(`  - ${b}`);
    }
  }
  for (const issue of envIssues) {
    console.log(`[fisc-001] ENV BLOCK: ${issue}`);
  }

  if (envIssues.length > 0 || readyCount === 0) {
    console.error("[fisc-001] FALHA — credenciais live nao prontas (dependencia PO).");
    process.exit(1);
  }

  console.log("[fisc-001] OK — pelo menos uma org com credenciais SERPRO live configuradas.");
}

main().catch((err) => {
  console.error("[fisc-001] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
