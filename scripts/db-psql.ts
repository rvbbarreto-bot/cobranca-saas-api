import "dotenv/config";
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.error("Defina DATABASE_URL no .env (ou no ambiente).");
  process.exit(1);
}

const passthrough = process.argv.slice(2);
const args = passthrough.length > 0 ? [url, ...passthrough] : [url];

const r = spawnSync("psql", args, { stdio: "inherit", shell: true });
if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") {
  console.error(
    "psql nao esta no PATH. Instale as ferramentas de linha de comando do PostgreSQL ou use:\n" +
      "  npm run db:portal-app-user\n" +
      '  npm run db:query -- "SELECT ..."'
  );
  process.exit(1);
}
process.exit(r.status ?? 1);
