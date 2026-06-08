import "dotenv/config";
import { runSeedPortalRbacUsers } from "../src/dev/seed-portal-rbac-users";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("[seed:dev-rbac] Defina DATABASE_URL.");
    process.exit(1);
  }

  const result = await runSeedPortalRbacUsers(url);
  // eslint-disable-next-line no-console
  console.log("[seed:dev-rbac] OK:", {
    tenant: result.automacaoTenantSlug,
    automacaoTenantId: result.automacaoTenantId,
    users: result.users
  });
  // eslint-disable-next-line no-console
  console.log(`
Login portal (http://localhost:5173/login):
  tenant_id: ${result.automacaoTenantSlug}  (ou id numerico ${result.automacaoTenantId})
  senha (ambos): ${result.passwordHint}

  ADMIN    → ${result.users.find((u) => u.role === "admin_escritorio")?.email}
  OPERADOR → ${result.users.find((u) => u.role === "operador")?.email}
`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[seed:dev-rbac] falhou:", err);
  process.exit(1);
});
