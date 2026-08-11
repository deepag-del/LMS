import { Router } from "express";
import multer from "multer";
import { PoolClient } from "pg";
import { pool } from "../db";
import { audit } from "../lib/audit";
import { requireRole } from "../lib/auth";
import { parseRoster, RosterRow } from "../lib/roster";

export const employees = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // a 200-person roster is well under 5 MB
});

employees.get("/api/employees", requireRole("hr_admin", "qa", "c_level"), async (req, res) => {
  const dept = req.query.department ? String(req.query.department) : null;
  const status = req.query.status ? String(req.query.status) : "active";
  const r = await pool!.query(
    `SELECT e.id, e.employee_code, e.full_name, e.email, d.name AS department,
            e.designation, e.manager_email, e.date_of_joining::text, e.status
     FROM employees e JOIN departments d ON d.id = e.department_id
     WHERE ($1::text IS NULL OR d.name = $1)
       AND ($2::text = 'all' OR e.status = $2)
     ORDER BY d.name, e.full_name`,
    [dept, status]
  );
  res.json(r.rows);
});

type UpsertResult = "created" | "updated" | "unchanged";

async function upsertEmployee(
  client: PoolClient,
  row: RosterRow,
  deptId: number
): Promise<UpsertResult> {
  const existing = await client.query(
    "SELECT id, full_name, email, department_id, designation, manager_email, date_of_joining::text, status FROM employees WHERE employee_code = $1",
    [row.employeeCode]
  );
  if (!existing.rowCount) {
    await client.query(
      `INSERT INTO employees (employee_code, full_name, email, department_id, designation, manager_email, date_of_joining)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [row.employeeCode, row.fullName, row.email, deptId, row.designation, row.managerEmail, row.dateOfJoining]
    );
    return "created";
  }
  const e = existing.rows[0];
  const same =
    e.full_name === row.fullName &&
    e.email.toLowerCase() === row.email.toLowerCase() &&
    e.department_id === deptId &&
    (e.designation ?? null) === row.designation &&
    (e.manager_email ?? null) === row.managerEmail &&
    (e.date_of_joining ?? null) === row.dateOfJoining &&
    e.status === "active";
  if (same) return "unchanged";
  await client.query(
    `UPDATE employees SET full_name = $2, email = $3, department_id = $4, designation = $5,
            manager_email = $6, date_of_joining = $7, status = 'active', updated_at = now()
     WHERE id = $1`,
    [e.id, row.fullName, row.email, deptId, row.designation, row.managerEmail, row.dateOfJoining]
  );
  return "updated";
}

// Roster import (new-hire sync path #1).
//   POST /api/admin/import/employees?mode=upsert|full&dryRun=true|false   (multipart, field "file")
// - upsert (default): rows are added/updated; employees absent from the file are left alone.
//   Safe for partial files, e.g. "this month's joiners".
// - full: the file is the complete active roster; active employees NOT in the file are
//   marked inactive (never deleted — history must survive for audit).
// - dryRun=true: parse + validate + report what WOULD happen, write nothing.
employees.post("/api/admin/import/employees", requireRole("hr_admin"), upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, detail: "Attach an .xlsx file in field \"file\"" });
  const mode = req.query.mode === "full" ? "full" : "upsert";
  const dryRun = String(req.query.dryRun) === "true";

  const parsed = await parseRoster(req.file.buffer);
  const errors = [...parsed.errors];

  const deptRows = await pool!.query("SELECT id, name FROM departments WHERE active");
  const deptByName = new Map<string, number>(
    deptRows.rows.map((d: { id: number; name: string }) => [d.name.toLowerCase(), d.id])
  );

  const valid: { row: RosterRow; deptId: number }[] = [];
  for (const row of parsed.rows) {
    const deptId = deptByName.get(row.department.toLowerCase());
    if (!deptId) {
      errors.push({
        rowNumber: row.rowNumber,
        message: `Unknown department "${row.department}" — valid: ${deptRows.rows.map((d: { name: string }) => d.name).join(", ")}`,
      });
      continue;
    }
    valid.push({ row, deptId });
  }

  let created = 0, updated = 0, unchanged = 0, deactivated = 0;
  const client = await pool!.connect();
  try {
    await client.query("BEGIN");
    for (const { row, deptId } of valid) {
      const result = await upsertEmployee(client, row, deptId);
      if (result === "created") created++;
      else if (result === "updated") updated++;
      else unchanged++;
    }
    if (mode === "full") {
      const codes = valid.map(v => v.row.employeeCode);
      const r = await client.query(
        `UPDATE employees SET status = 'inactive', updated_at = now()
         WHERE status = 'active' AND NOT (employee_code = ANY($1))`,
        [codes]
      );
      deactivated = r.rowCount ?? 0;
    }
    if (dryRun) await client.query("ROLLBACK");
    else await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    client.release();
    throw e;
  }
  client.release();

  const summary = {
    ok: errors.length === 0,
    mode,
    dryRun,
    totalRowsInFile: parsed.rows.length + parsed.errors.length,
    created, updated, unchanged, deactivated,
    errorCount: errors.length,
    errors: errors.slice(0, 50),
  };

  if (!dryRun) {
    await pool!.query(
      `INSERT INTO import_runs (filename, mode, dry_run, created_count, updated_count, deactivated_count, error_count, errors)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [req.file.originalname, mode, dryRun, created, updated, deactivated, errors.length, JSON.stringify(errors)]
    );
    await audit("employees.imported", "import_run", req.file.originalname, summary, "hr-admin");
  }
  res.status(errors.length && !valid.length ? 400 : 200).json(summary);
});

// New-hire sync path #2: webhook for the HR system to push a single joiner/change.
//   POST /api/admin/employees/webhook   header: x-webhook-secret: <WEBHOOK_SECRET>
//   body: { employeeCode, fullName, email, department, designation?, managerEmail?, dateOfJoining? }
employees.post("/api/admin/employees/webhook", async (req, res) => {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ ok: false, detail: "Webhook disabled: WEBHOOK_SECRET not set" });
  if (req.get("x-webhook-secret") !== secret) {
    return res.status(401).json({ ok: false, detail: "Invalid webhook secret" });
  }
  const b = req.body ?? {};
  const required = ["employeeCode", "fullName", "email", "department"].filter(k => !b[k]);
  if (required.length) {
    return res.status(400).json({ ok: false, detail: `Missing field(s): ${required.join(", ")}` });
  }
  const dept = await pool!.query("SELECT id FROM departments WHERE active AND lower(name) = lower($1)", [b.department]);
  if (!dept.rowCount) return res.status(400).json({ ok: false, detail: `Unknown department "${b.department}"` });

  const row: RosterRow = {
    rowNumber: 0,
    employeeCode: String(b.employeeCode),
    fullName: String(b.fullName),
    email: String(b.email),
    department: String(b.department),
    designation: b.designation ? String(b.designation) : null,
    managerEmail: b.managerEmail ? String(b.managerEmail) : null,
    dateOfJoining: b.dateOfJoining ? String(b.dateOfJoining) : null,
  };
  const client = await pool!.connect();
  try {
    await client.query("BEGIN");
    const result = await upsertEmployee(client, row, dept.rows[0].id);
    await client.query("COMMIT");
    await audit("employee.webhook_sync", "employee", row.employeeCode, { result, ...b }, "hr-webhook");
    res.json({ ok: true, result, employeeCode: row.employeeCode });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
});
