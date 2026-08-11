// Minimal, transparent SQL migration runner.
// Usage: npm run migrate  — applies every migrations/NNN_*.sql not yet recorded
// in schema_migrations, each inside a transaction, in filename order.
// Deliberately no down-migrations: in a compliance system, schema changes only
// move forward and are corrected by a new migration, never by rolling back.
import fs from "fs";
import path from "path";
import { pool } from "./db";

async function main() {
  if (!pool) throw new Error("DATABASE_URL is not set in .env");
  const dir = path.join(__dirname, "..", "migrations");
  const files = fs.readdirSync(dir).filter(f => /^\d{3}_.*\.sql$/.test(f)).sort();

  await pool.query(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
  );
  const done = new Set(
    (await pool.query("SELECT id FROM schema_migrations")).rows.map(r => r.id)
  );

  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (id) VALUES ($1)", [f]);
      await client.query("COMMIT");
      console.log(`applied ${f}`);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error(`FAILED ${f}: ${(e as Error).message}`);
      process.exit(1);
    } finally {
      client.release();
    }
  }
  console.log("migrations up to date");
  await pool.end();
}

main();
