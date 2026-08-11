import { Pool } from "pg";
import { config } from "./config";

// Single shared connection pool for the whole app.
// E2E DBaaS requires SSL; sslmode=require in DATABASE_URL handles it.
export const pool = config.databaseUrl
  ? new Pool({ connectionString: config.databaseUrl, max: 10 })
  : null;

export async function checkDb(): Promise<{ ok: boolean; detail: string }> {
  if (!pool) return { ok: false, detail: "DATABASE_URL is not set in .env" };
  try {
    const r = await pool.query("SELECT now() AT TIME ZONE 'Asia/Kolkata' AS ist_now, version()");
    return { ok: true, detail: `connected — DB time (IST): ${r.rows[0].ist_now}` };
  } catch (e) {
    return { ok: false, detail: `connection failed: ${(e as Error).message}` };
  }
}
