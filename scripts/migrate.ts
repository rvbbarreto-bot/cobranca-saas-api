import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("Defina DATABASE_URL para executar migrations.");
    process.exit(1);
  }

  const dir = path.join(__dirname, "..", "db", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    for (const file of files) {
      const migrationFile = path.join(dir, file);
      const sql = fs.readFileSync(migrationFile, "utf8");
      await client.query(sql);
      console.log("[migrate] OK:", migrationFile);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[migrate] falhou:", err);
  process.exit(1);
});
