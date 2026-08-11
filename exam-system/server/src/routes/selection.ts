import { Router } from "express";
import { pool } from "../db";
import { audit } from "../lib/audit";
import { requireRole } from "../lib/auth";
import { currentCycle, monthsRemainingInCycle, todayIst } from "../lib/cycles";

export const selection = Router();

// Per-department picture of the current cycle: who is covered, who remains.
selection.get("/api/selection/status", requireRole("hr_admin", "qa", "c_level"), async (_req, res) => {
  const cycle = currentCycle();
  const r = await pool!.query(
    `SELECT d.name AS department,
            count(e.id) FILTER (WHERE e.status = 'active')::int AS active_employees,
            count(a.id)::int                                     AS selected,
            count(a.id) FILTER (WHERE a.status = 'passed')::int  AS passed,
            count(a.id) FILTER (WHERE a.status = 'failed')::int  AS failed,
            count(a.id) FILTER (WHERE a.status IN ('assigned', 'in_progress'))::int AS open,
            (count(e.id) FILTER (WHERE e.status = 'active') - count(a.id) FILTER (WHERE a.status <> 'cancelled'))::int AS remaining
     FROM departments d
     LEFT JOIN employees e ON e.department_id = d.id
     LEFT JOIN exam_assignments a ON a.employee_id = e.id AND a.cycle = $1
     WHERE d.active
     GROUP BY d.name ORDER BY d.name`,
    [cycle]
  );
  res.json({
    cycle,
    monthsRemaining: monthsRemainingInCycle(todayIst()),
    departments: r.rows,
  });
});

// Monthly selection run (LOCKED rules: random, department-wise, one assignment
// per employee per cycle — the DB UNIQUE constraint backs the eligibility query).
// Auto count = ceil(remaining / months left) so the cycle finishes on time.
selection.post("/api/selection/run", requireRole("hr_admin"), async (req, res) => {
  const { department, count, dryRun } = req.body ?? {};
  const cycle = currentCycle();
  const monthsLeft = monthsRemainingInCycle(todayIst());

  const depts = await pool!.query(
    "SELECT id, name FROM departments WHERE active AND ($1::text IS NULL OR name = $1) ORDER BY name",
    [department ?? null]
  );
  if (!depts.rowCount) return res.status(400).json({ ok: false, detail: "Unknown department" });

  const results = [];
  const client = await pool!.connect();
  try {
    await client.query("BEGIN");
    for (const d of depts.rows) {
      // Eligible: active employees with no non-cancelled assignment this cycle.
      const eligible = await client.query(
        `SELECT e.id, e.full_name, e.employee_code
         FROM employees e
         WHERE e.department_id = $1 AND e.status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM exam_assignments a
             WHERE a.employee_id = e.id AND a.cycle = $2 AND a.status <> 'cancelled')
         ORDER BY random()`,
        [d.id, cycle]
      );
      const remaining = eligible.rowCount ?? 0;
      const take = count != null
        ? Math.min(Number(count), remaining)
        : Math.ceil(remaining / monthsLeft);
      const picked = eligible.rows.slice(0, take);
      if (!dryRun) {
        for (const p of picked) {
          await client.query(
            `INSERT INTO exam_assignments (employee_id, department_id, cycle, selected_by)
             VALUES ($1, $2, $3, $4)`,
            [p.id, d.id, cycle, req.user!.id]
          );
        }
      }
      results.push({
        department: d.name,
        eligibleBefore: remaining,
        selected: picked.map(p => ({ employeeCode: p.employee_code, name: p.full_name })),
      });
    }
    if (dryRun) await client.query("ROLLBACK");
    else await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    client.release();
    throw e;
  }
  client.release();

  const totalSelected = results.reduce((s, r) => s + r.selected.length, 0);
  if (!dryRun && totalSelected > 0) {
    await audit("selection.run", "cycle", cycle, {
      by: req.user!.email,
      departments: results.map(r => ({ department: r.department, count: r.selected.length })),
    }, req.user!.email);
  }
  res.json({ ok: true, cycle, dryRun: Boolean(dryRun), monthsRemaining: monthsLeft, totalSelected, results });
});

selection.get("/api/assignments", requireRole("hr_admin", "qa", "c_level"), async (req, res) => {
  const cycle = req.query.cycle ? String(req.query.cycle) : currentCycle();
  const dept = req.query.department ? String(req.query.department) : null;
  const r = await pool!.query(
    `SELECT a.id, a.cycle, a.status, a.selected_at::date::text AS selected_on,
            e.employee_code, e.full_name, d.name AS department, u.full_name AS selected_by
     FROM exam_assignments a
     JOIN employees e ON e.id = a.employee_id
     JOIN departments d ON d.id = a.department_id
     JOIN users u ON u.id = a.selected_by
     WHERE a.cycle = $1 AND ($2::text IS NULL OR d.name = $2)
     ORDER BY d.name, e.full_name`,
    [cycle, dept]
  );
  res.json(r.rows);
});

// HR can cancel an assignment that has not started (employee left, long leave, …).
selection.post("/api/assignments/:id/cancel", requireRole("hr_admin"), async (req, res) => {
  const reason = req.body?.reason?.trim();
  if (!reason) return res.status(400).json({ ok: false, detail: "A cancellation reason is required" });
  const r = await pool!.query(
    `UPDATE exam_assignments SET status = 'cancelled', updated_at = now()
     WHERE id = $1 AND status = 'assigned' RETURNING employee_id`,
    [req.params.id]
  );
  if (!r.rowCount) {
    return res.status(409).json({ ok: false, detail: "Only not-yet-started assignments can be cancelled" });
  }
  await audit("assignment.cancelled", "exam_assignment", req.params.id, { reason }, req.user!.email);
  res.json({ ok: true });
});

// An employee's own assignments (drives the "My exams" tab).
selection.get("/api/my/assignments", async (req, res) => {
  if (!req.user!.employeeId) return res.json([]);
  const r = await pool!.query(
    `SELECT a.id, a.cycle, a.status, a.selected_at::date::text AS selected_on
     FROM exam_assignments a WHERE a.employee_id = $1 ORDER BY a.selected_at DESC`,
    [req.user!.employeeId]
  );
  res.json(r.rows);
});
