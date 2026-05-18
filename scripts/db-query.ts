import "dotenv/config";
import pg from "pg";

async function main(): Promise<void> {
  const sql = process.argv.slice(2).join(" ").trim();
  if (!sql) {
    console.error('Uso: npm run db:query -- "SELECT ..."');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("Defina DATABASE_URL no .env.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const res = await client.query(sql);
    if (res.rows.length === 0) {
      console.log("(0 linhas)");
      if (res.command && res.command !== "SELECT") {
        console.log("Comando:", res.command, "rowCount:", res.rowCount);
      }
    } else {
      console.log(JSON.stringify(res.rows, null, 2));
    }
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
