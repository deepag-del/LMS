import { pool } from "../db";

// Every meaningful action goes through here (LOCKED rule).
// The audit_log table has a DB trigger that rejects UPDATE/DELETE,
// so a row written here can never be altered.
export async function audit(
  action: string,
  entity: string | null,
  entityId: string | null,
  details: unknown,
  actor = "system"
): Promise<void> {
  if (!pool) return;
  await pool.query(
    "INSERT INTO audit_log (actor, action, entity, entity_id, details) VALUES ($1, $2, $3, $4, $5)",
    [actor, action, entity, entityId, details == null ? null : JSON.stringify(details)]
  );
}
