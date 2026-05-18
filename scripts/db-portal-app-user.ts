import "dotenv/config";
import pg from "pg";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.error("Defina DATABASE_URL no .env.");
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    const cols = await client.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns
       WHERE table_schema = 'portal' AND table_name = 'app_user'
       ORDER BY ordinal_position`
    );
    console.log("--- portal.app_user (colunas) ---");
    console.log(JSON.stringify(cols.rows, null, 2));

    const hasPasswordHash = cols.rows.some((c) => c.column_name === "password_hash");
    if (!hasPasswordHash) {
      console.log(
        "\n--- aviso ---\n" +
          "Coluna password_hash ainda nao existe (migracao 011). Aplique o schema e rode o seed:\n" +
          "  npm run migrate\n" +
          "  npm run seed:dev\n"
      );
    }

    const rows = hasPasswordHash
      ? await client.query(
          `SELECT id::text, email, full_name,
                  CASE WHEN password_hash IS NULL THEN 'NULL' ELSE 'preenchido' END AS senha
           FROM portal.app_user
           ORDER BY email`
        )
      : await client.query(
          `SELECT id::text, email, full_name
           FROM portal.app_user
           ORDER BY email`
        );
    console.log("--- portal.app_user (dados) ---");
    console.log(JSON.stringify(rows.rows, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
