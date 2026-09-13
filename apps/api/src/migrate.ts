import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(here, "..", "db", "migrations");

export async function runMigrations() {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`
  );
  if (!existsSync(migrationsDir)) {
    return;
  }
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const f of files) {
    const applied = await pool.query(
      "SELECT 1 FROM schema_migrations WHERE name = $1",
      [f]
    );
    if (applied.rowCount) {
      continue;
    }
    const sql = readFileSync(join(migrationsDir, f), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        "INSERT INTO schema_migrations(name) VALUES ($1)",
        [f]
      );
      await client.query("COMMIT");
      console.log("[migrate] applied:", f);
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].includes("migrate")) {
  runMigrations()
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

