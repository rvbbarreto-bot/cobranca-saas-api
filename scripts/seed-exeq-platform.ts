import "dotenv/config";
import { runSeedExeqPlatform } from "../src/dev/seed-exeq-platform";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("[seed:exeq-platform] Defina DATABASE_URL.");
    process.exit(1);
  }

  const result = await runSeedExeqPlatform(url);
  // eslint-disable-next-line no-console
  console.log("[seed:exeq-platform] OK:", result);
  // eslint-disable-next-line no-console
  console.log(`
Console master EXEQ (http://localhost:5173/exeq/login):
  e-mail: ${result.masterEmail}
  senha:  ${result.masterPasswordHint}

Escritórios (login portal /login com tenant = slug):
${result.escritorios
  .map(
    (e) =>
      `  • ${e.name} → tenant_id: ${e.slug} | admin: ${e.adminEmail} | senha: ${result.masterPasswordHint}`
  )
  .join("\n")}
`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[seed:exeq-platform] falhou:", err);
  process.exit(1);
});
