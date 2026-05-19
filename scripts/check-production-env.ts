import "dotenv/config";
import { databaseUrlIndicatesTls, shouldEnforceDatabaseTlsInChecks } from "../src/platform/health/database-url-tls";
/**
 * Valida variaveis criticas antes do deploy em producao.
 * Uso: NODE_ENV=production npm run check:prod-env
 * Ou em pipeline: npm run check:prod-env -- --strict (le .env com NODE_ENV ja definido no job)
 */

function fail(msg: string): never {
  // eslint-disable-next-line no-console
  console.error("[check:prod-env]", msg);
  process.exit(1);
}

function warn(msg: string): void {
  // eslint-disable-next-line no-console
  console.warn("[check:prod-env] AVISO:", msg);
}

function main(): void {
  const strict =
    process.argv.includes("--strict") ||
    process.env.NODE_ENV === "production" ||
    process.env.FORCE_PROD_ENV_CHECK === "1";

  const jwt = process.env.JWT_SECRET?.trim();
  const webhook = process.env.WEBHOOK_INBOX_SECRET?.trim();
  const mockAuth = process.env.ENABLE_MOCK_AUTH?.trim().toLowerCase();
  const cors = process.env.CORS_ORIGIN?.trim();
  const db = process.env.DATABASE_URL?.trim();

  const issues: string[] = [];

  if (!db) {
    issues.push("DATABASE_URL ausente");
  } else if (shouldEnforceDatabaseTlsInChecks() && !databaseUrlIndicatesTls(db)) {
    issues.push(
      "DATABASE_URL nao indica TLS (sslmode=require/verify-full/verify-ca ou ssl=true). Use ALLOW_INSECURE_DATABASE_URL=1 apenas em dev local."
    );
  }

  if (!jwt || jwt.length < 32) {
    const len = jwt ? jwt.length : 0;
    issues.push(
      `JWT_SECRET ausente ou com menos de 32 caracteres (atual: ${len}). Ajuste o .env ou defina $env:JWT_SECRET no PowerShell.`
    );
  }

  if (!webhook) {
    issues.push("WEBHOOK_INBOX_SECRET ausente (POST /v1/inbox/webhooks retorna 503 em producao)");
  }

  if (mockAuth === "true" || mockAuth === "1") {
    issues.push("ENABLE_MOCK_AUTH=true expoe rotas mock em producao — use false");
  }

  if (!strict) {
    // eslint-disable-next-line no-console
    console.log(
      "[check:prod-env] Modo advisory (defina NODE_ENV=production, FORCE_PROD_ENV_CHECK=1 ou --strict para falhar)."
    );
    if (issues.length) {
      issues.forEach((i) => warn(i));
    } else {
      // eslint-disable-next-line no-console
      console.log("[check:prod-env] Nenhum problema obvio detectado nas variaveis checadas.");
    }
    if (!cors) {
      warn("CORS_ORIGIN vazio: em producao o portal no browser nao recebe CORS aberto; defina origens se o front for separado.");
    }
    return;
  }

  if (issues.length) {
    issues.forEach((i) => {
      // eslint-disable-next-line no-console
      console.error("[check:prod-env] BLOQUEIO:", i);
    });
    fail("Corrija o ambiente antes de publicar.");
  }

  if (!cors) {
    warn("CORS_ORIGIN vazio — OK se API for apenas server-to-server; se houver front em outro dominio, configure.");
  }

  // eslint-disable-next-line no-console
  console.log("[check:prod-env] OK: checagens minimas de producao passaram.");
}

main();
