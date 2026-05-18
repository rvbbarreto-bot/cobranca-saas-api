/**
 * Carga controlada em POST /v1/portal/clientes (CNPJ unico por requisicao).
 *
 * Uso:
 *   DATABASE_URL=... npm run test:load:portal-clientes
 *
 * Opcionais:
 *   LOAD_TOTAL=200 LOAD_CONCURRENCY=30
 *
 * Autenticacao: `POST /v1/portal/auth/login` com usuario seed (nao depende de ENABLE_MOCK_AUTH).
 */
import "dotenv/config";
import request from "supertest";
import { performance } from "node:perf_hooks";
import { createApp } from "../src/app";
import {
  runSeedPortalHappyPath,
  SEED_AUTOMACAO_SLUG,
  SEED_PORTAL_DEFAULT_PASSWORD,
  SEED_PORTAL_EMAIL
} from "../src/dev/seed-portal-happy-path";
import { uniqueTestCnpj } from "../src/modules/portal-read/application/br-cpf-cnpj";
import { closePool } from "../src/platform/persistence/pool";

function portalAuthHeaders(token: string): { Authorization: string; "x-tenant-id": string } {
  return { Authorization: `Bearer ${token}`, "x-tenant-id": SEED_AUTOMACAO_SLUG };
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("Defina DATABASE_URL.");
    process.exit(1);
  }

  const total = Math.min(Number(process.env.LOAD_TOTAL ?? "80"), 5000);
  const concurrency = Math.min(Number(process.env.LOAD_CONCURRENCY ?? "25"), 200);
  const app = createApp();

  const seed = await runSeedPortalHappyPath(url);
  const rPortal = await request(app)
    .post("/v1/portal/auth/login")
    .send({
      email: SEED_PORTAL_EMAIL,
      tenant_id: seed.automacaoTenantId,
      password: SEED_PORTAL_DEFAULT_PASSWORD
    });
  if (rPortal.status !== 200) {
    console.error("Falha login portal (use seed ou SEED_PORTAL_PASSWORD):", rPortal.status, rPortal.text);
    await closePool();
    process.exit(1);
  }
  const token = rPortal.body.access_token as string;

  const latencies: number[] = [];
  let ok = 0;
  let e422 = 0;
  let e409 = 0;
  let eOther = 0;

  const tStart = performance.now();
  let cursor = 0;

  async function worker(workerId: number): Promise<void> {
    for (;;) {
      const i = cursor;
      cursor += 1;
      if (i >= total) {
        return;
      }
      const t0 = performance.now();
      const documento = uniqueTestCnpj(Date.now() + i * 7919 + workerId, i * 13 + workerId * 997);
      const res = await request(app)
        .post("/v1/portal/clientes")
        .set(portalAuthHeaders(token))
        .send({
          documento,
          nome: `Load ${i}`,
          email: null,
          whatsapp_opt_in: false
        });
      latencies.push(performance.now() - t0);
      if (res.status === 201) {
        ok += 1;
      } else if (res.status === 422) {
        e422 += 1;
      } else if (res.status === 409) {
        e409 += 1;
      } else {
        eOther += 1;
        if (eOther <= 5) {
          console.error("Resposta inesperada", res.status, res.text?.slice(0, 200));
        }
      }
    }
  }

  const workers = Array.from({ length: concurrency }, (_, w) => worker(w));
  await Promise.all(workers);
  const elapsedMs = performance.now() - tStart;

  latencies.sort((a, b) => a - b);
  const p = (q: number) => latencies[Math.floor((latencies.length - 1) * q)] ?? 0;

  console.log(
    JSON.stringify(
      {
        totalRequests: total,
        concurrency,
        elapsedMs: Math.round(elapsedMs),
        rps: Math.round((total / elapsedMs) * 1000),
        status201: ok,
        status422: e422,
        status409: e409,
        other: eOther,
        latencyMs: {
          p50: Math.round(p(0.5)),
          p95: Math.round(p(0.95)),
          max: Math.round(p(1))
        }
      },
      null,
      2
    )
  );

  await closePool();
  if (ok !== total) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  void closePool().finally(() => process.exit(1));
});
