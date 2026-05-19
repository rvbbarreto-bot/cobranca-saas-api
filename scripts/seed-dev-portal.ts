import "dotenv/config";
import { runSeedPortalHappyPath } from "../src/dev/seed-portal-happy-path";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("[seed:dev] Defina DATABASE_URL.");
    process.exit(1);
  }

  const result = await runSeedPortalHappyPath(url);
  // eslint-disable-next-line no-console
  console.log("[seed:dev] OK:", result);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[seed:dev] falhou:", err);
  process.exit(1);
});
