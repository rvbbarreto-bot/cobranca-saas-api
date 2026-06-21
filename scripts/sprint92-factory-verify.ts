/**
 * Fábrica — Playwright E2E portal fiscal live + SERPRO mock (EXEQ-FISC-092).
 * Espelha `.github/workflows/fiscal-portal-e2e.yml`.
 * Uso: npm run verify:sprint92
 */
import "dotenv/config";
import { execSync, spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const ROOT = process.cwd();
const PORTAL_DIR = join(ROOT, "apps/portal-web");
/** Portas dedicadas ao gate — evita colisao com dev Docker (:3333) ou homolog Inter (:3334). */
const GATE_API_PORT = process.env.SPRINT92_API_PORT ?? "3335";
const GATE_PORTAL_PORT = process.env.SPRINT92_PORTAL_PORT ?? "5175";
const API_URL = process.env.E2E_API_URL ?? `http://127.0.0.1:${GATE_API_PORT}`;
const PORTAL_URL = process.env.E2E_PORTAL_URL ?? `http://127.0.0.1:${GATE_PORTAL_PORT}`;

const spawned: ChildProcess[] = [];

function run(cmd: string, cwd = ROOT, env: NodeJS.ProcessEnv = process.env): void {
  console.log(`\n[sprint92-verify] $ ${cmd}`);
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env }
  });
}

async function dbReachable(url: string): Promise<boolean> {
  const client = new pg.Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    await client.query("SELECT 1");
    return true;
  } catch {
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function ensurePostgres(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error("DATABASE_URL ausente.");
  if (await dbReachable(url)) return;
  run("docker compose up -d postgres");
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (await dbReachable(url)) return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error("Postgres indisponivel.");
}

async function httpOk(url: string, timeoutMs = 5000): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForUrl(label: string, url: string, attempts = 30, intervalMs = 2000): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    if (await httpOk(url)) {
      console.log(`[sprint92-verify] ${label} OK (${url})`);
      return;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`${label} indisponivel em ${url}`);
}

function startDetached(cmd: string, cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(cmd, {
    cwd,
    shell: true,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ...env }
  });
  child.unref();
  spawned.push(child);
  return child;
}

function stopSpawned(): void {
  for (const child of spawned) {
    try {
      if (child.pid) process.kill(child.pid);
    } catch {
      /* already stopped */
    }
  }
}

async function main(): Promise<void> {
  const startedAt = new Date().toISOString();

  if (!process.env.ENCRYPTION_KEY?.trim()) {
    process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    console.warn("[sprint92-verify] ENCRYPTION_KEY ausente — usando chave dev local.");
  }

  const gateEnv: NodeJS.ProcessEnv = {
    PORT: GATE_API_PORT,
    FISCAL_GUIAS_ENABLED: "true",
    FISCAL_SERPRO_ENABLED: "true",
    FISCAL_SERPRO_MOCK: "true",
    FISCAL_SERPRO_REQUIRE_PROCURACAO: "false",
    ENABLE_BULLMQ_WORKERS: "false",
    ENABLE_MOCK_AUTH: "false",
    NODE_ENV: "development",
    E2E_API_URL: API_URL,
    E2E_PORTAL_URL: PORTAL_URL,
    E2E_FISCAL_LIVE: "1",
    E2E_FISCAL_MOCK: "0"
  };

  await ensurePostgres();
  run("npm run migrate", ROOT, gateEnv);
  run("npm run seed:dev", ROOT, gateEnv);
  run("npm run backfill:organization", ROOT, gateEnv);
  run("npm run seed:fiscal-portal-e2e", ROOT, gateEnv);
  run("npm run build", ROOT, gateEnv);

  console.log(`[sprint92-verify] Subindo API isolada em :${GATE_API_PORT} (SERPRO mock, jobs inline)`);
  startDetached("npm start", ROOT, gateEnv);
  await waitForUrl("API", `${API_URL}/health/ready`);

  console.log(`[sprint92-verify] Subindo portal isolado em :${GATE_PORTAL_PORT} (proxy /v1 -> :${GATE_API_PORT})`);
  startDetached(`npm run dev -- --host 127.0.0.1 --port ${GATE_PORTAL_PORT}`, PORTAL_DIR, {
    ...gateEnv,
    VITE_FISCAL_GUIAS_ENABLED: "true",
    VITE_DEV_PROXY_TARGET: API_URL
  });
  await waitForUrl("Portal", PORTAL_URL, 45);

  try {
    run("npm run e2e:fiscal-portal:live", ROOT, gateEnv);
  } finally {
    stopSpawned();
  }

  const evidenceDir = join(ROOT, "docs/evidencias/sprint-92");
  mkdirSync(evidenceDir, { recursive: true });
  writeFileSync(
    join(evidenceDir, `sprint92-verify-${startedAt.replace(/[:.]/g, "-")}.json`),
    JSON.stringify(
      {
        sprint: 92,
        issue: "EXEQ-FISC-092",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        mode: "playwright-live-serpro-mock",
        flow: "upload CSV → stepper → recibo → DAS PDF",
        script: "npm run e2e:fiscal-portal:live",
        ci_workflow: ".github/workflows/fiscal-portal-e2e.yml"
      },
      null,
      2
    )
  );

  console.log(`\n[sprint92-verify] OK — FISC-092 verificado em ${startedAt}`);
}

process.on("SIGINT", () => {
  stopSpawned();
  process.exit(130);
});

main().catch((err) => {
  stopSpawned();
  console.error("[sprint92-verify] FALHA:", err instanceof Error ? err.message : err);
  process.exit(1);
});
