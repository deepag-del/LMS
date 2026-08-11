import { Request, Response, Router } from "express";
import { pool } from "../db";
import { config } from "../config";
import { audit } from "../lib/audit";
import { requireRole } from "../lib/auth";

export const questions = Router();

// A dept_manager authors for the department of their linked employee record.
async function authorDepartment(req: Request, res: Response): Promise<number | null> {
  if (!req.user!.employeeId) {
    res.status(400).json({
      ok: false,
      detail: "Your login is not linked to an employee record — ask HR to re-provision it from the roster so your department is known.",
    });
    return null;
  }
  const r = await pool!.query("SELECT department_id FROM employees WHERE id = $1", [req.user!.employeeId]);
  return r.rows[0].department_id;
}

// ---------- SOP registry ----------

questions.get("/api/sops", requireRole("dept_manager", "c_level", "hr_admin", "qa"), async (req, res) => {
  const dept = req.query.department ? String(req.query.department) : null;
  const r = await pool!.query(
    `SELECT s.id, s.sop_number, s.title, s.active, d.name AS department
     FROM sops s JOIN departments d ON d.id = s.department_id
     WHERE ($1::text IS NULL OR d.name = $1) AND s.active
     ORDER BY d.name, s.sop_number`,
    [dept]
  );
  res.json(r.rows);
});

questions.post("/api/sops", requireRole("dept_manager", "hr_admin"), async (req, res) => {
  const { sopNumber, title, departmentId } = req.body ?? {};
  if (!sopNumber?.trim() || !title?.trim()) {
    return res.status(400).json({ ok: false, detail: "Provide sopNumber and title" });
  }
  // dept_manager can only register SOPs for their own department; hr_admin picks any.
  let deptId: number;
  if (req.user!.role === "dept_manager") {
    const own = await authorDepartment(req, res);
    if (own === null) return;
    deptId = own;
  } else {
    if (!departmentId) return res.status(400).json({ ok: false, detail: "Provide departmentId" });
    deptId = Number(departmentId);
  }
  try {
    const r = await pool!.query(
      "INSERT INTO sops (department_id, sop_number, title) VALUES ($1, $2, $3) RETURNING id",
      [deptId, sopNumber.trim(), title.trim()]
    );
    await audit("sop.added", "sop", String(r.rows[0].id), { sopNumber, title, deptId }, req.user!.email);
    res.status(201).json({ ok: true, id: r.rows[0].id });
  } catch (e) {
    if ((e as { code?: string }).code === "23505") {
      return res.status(409).json({ ok: false, detail: `SOP ${sopNumber} already registered for this department` });
    }
    throw e;
  }
});

// ---------- Question CRUD + workflow ----------

function validateQuestionBody(body: Record<string, unknown>): string | null {
  const { questionText, options, correctIndex } = body;
  if (typeof questionText !== "string" || questionText.trim().length < 10) {
    return "Question text must be at least 10 characters";
  }
  if (!Array.isArray(options) || options.length !== 4 ||
      options.some(o => typeof o !== "string" || !o.trim())) {
    return "Provide exactly 4 non-empty options";
  }
  const texts = (options as string[]).map(o => o.trim().toLowerCase());
  if (new Set(texts).size !== 4) return "Options must be distinct";
  if (typeof correctIndex !== "number" || correctIndex < 0 || correctIndex > 3) {
    return "correctIndex must be 0-3";
  }
  return null;
}

questions.get("/api/questions", requireRole("dept_manager", "c_level", "hr_admin", "qa"), async (req, res) => {
  let dept = req.query.department ? String(req.query.department) : null;
  const status = req.query.status ? String(req.query.status) : null;

  // dept_manager only ever sees their own department's bank.
  if (req.user!.role === "dept_manager") {
    const own = await authorDepartment(req, res);
    if (own === null) return;
    const d = await pool!.query("SELECT name FROM departments WHERE id = $1", [own]);
    dept = d.rows[0].name;
  }

  const r = await pool!.query(
    `SELECT q.id, q.question_text, q.options, q.correct_index, q.status, q.version,
            q.review_comment, q.created_at, q.updated_at,
            d.name AS department, s.sop_number, s.title AS sop_title,
            cu.full_name AS created_by, ru.full_name AS reviewed_by
     FROM questions q
     JOIN departments d ON d.id = q.department_id
     JOIN sops s ON s.id = q.sop_id
     JOIN users cu ON cu.id = q.created_by
     LEFT JOIN users ru ON ru.id = q.reviewed_by
     WHERE ($1::text IS NULL OR d.name = $1)
       AND ($2::text IS NULL OR q.status = $2)
     ORDER BY q.status = 'pending' DESC, q.updated_at DESC`,
    [dept, status]
  );
  res.json(r.rows);
});

questions.post("/api/questions", requireRole("dept_manager"), async (req, res) => {
  const err = validateQuestionBody(req.body ?? {});
  if (err) return res.status(400).json({ ok: false, detail: err });
  const deptId = await authorDepartment(req, res);
  if (deptId === null) return;

  const sop = await pool!.query(
    "SELECT id FROM sops WHERE id = $1 AND department_id = $2 AND active",
    [req.body.sopId, deptId]
  );
  if (!sop.rowCount) {
    return res.status(400).json({ ok: false, detail: "Pick an SOP registered for your department" });
  }
  const r = await pool!.query(
    `INSERT INTO questions (department_id, sop_id, question_text, options, correct_index, created_by)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [deptId, req.body.sopId, req.body.questionText.trim(),
     JSON.stringify((req.body.options as string[]).map(o => o.trim())), req.body.correctIndex, req.user!.id]
  );
  await audit("question.submitted", "question", String(r.rows[0].id),
    { deptId, sopId: req.body.sopId }, req.user!.email);
  res.status(201).json({ ok: true, id: r.rows[0].id, status: "pending" });
});

questions.put("/api/questions/:id", requireRole("dept_manager"), async (req, res) => {
  const err = validateQuestionBody(req.body ?? {});
  if (err) return res.status(400).json({ ok: false, detail: err });
  const deptId = await authorDepartment(req, res);
  if (deptId === null) return;

  const q = await pool!.query("SELECT department_id, status FROM questions WHERE id = $1", [req.params.id]);
  if (!q.rowCount) return res.status(404).json({ ok: false, detail: "Question not found" });
  if (q.rows[0].department_id !== deptId) {
    return res.status(403).json({ ok: false, detail: "You can only edit your own department's questions" });
  }
  if (!["pending", "rejected"].includes(q.rows[0].status)) {
    return res.status(409).json({
      ok: false,
      detail: "Approved questions cannot be edited — retire it and submit a replacement",
    });
  }
  const sop = await pool!.query(
    "SELECT id FROM sops WHERE id = $1 AND department_id = $2 AND active",
    [req.body.sopId, deptId]
  );
  if (!sop.rowCount) {
    return res.status(400).json({ ok: false, detail: "Pick an SOP registered for your department" });
  }
  await pool!.query(
    `UPDATE questions SET question_text = $2, options = $3, correct_index = $4, sop_id = $5,
            status = 'pending', version = version + 1,
            reviewed_by = NULL, reviewed_at = NULL, review_comment = NULL, updated_at = now()
     WHERE id = $1`,
    [req.params.id, req.body.questionText.trim(),
     JSON.stringify((req.body.options as string[]).map((o: string) => o.trim())),
     req.body.correctIndex, req.body.sopId]
  );
  await audit("question.updated", "question", req.params.id, { resubmitted: true }, req.user!.email);
  res.json({ ok: true, status: "pending" });
});

// C-level approval (LOCKED rule: submit -> C-level approve -> live).
questions.post("/api/questions/:id/review", requireRole("c_level"), async (req, res) => {
  const { decision, comment } = req.body ?? {};
  if (!["approve", "reject"].includes(decision)) {
    return res.status(400).json({ ok: false, detail: "decision must be 'approve' or 'reject'" });
  }
  if (decision === "reject" && !comment?.trim()) {
    return res.status(400).json({ ok: false, detail: "A rejection needs a comment so the author can fix the question" });
  }
  const r = await pool!.query(
    `UPDATE questions SET status = $2, reviewed_by = $3, reviewed_at = now(),
            review_comment = $4, updated_at = now()
     WHERE id = $1 AND status = 'pending' RETURNING department_id`,
    [req.params.id, decision === "approve" ? "approved" : "rejected", req.user!.id, comment?.trim() ?? null]
  );
  if (!r.rowCount) {
    return res.status(409).json({ ok: false, detail: "Question is not pending review" });
  }
  await audit(`question.${decision}d`, "question", req.params.id, { comment: comment ?? null }, req.user!.email);
  res.json({ ok: true });
});

questions.post("/api/questions/:id/retire", requireRole("c_level", "hr_admin"), async (req, res) => {
  const r = await pool!.query(
    "UPDATE questions SET status = 'retired', updated_at = now() WHERE id = $1 AND status = 'approved' RETURNING id",
    [req.params.id]
  );
  if (!r.rowCount) return res.status(409).json({ ok: false, detail: "Only approved questions can be retired" });
  await audit("question.retired", "question", req.params.id, null, req.user!.email);
  res.json({ ok: true });
});

// Bank readiness vs the 50-questions-per-department target.
questions.get("/api/questions/bank-status", requireRole("c_level", "hr_admin", "qa", "dept_manager"), async (_req, res) => {
  const r = await pool!.query(
    `SELECT d.name AS department,
            count(q.id) FILTER (WHERE q.status = 'approved')::int AS approved,
            count(q.id) FILTER (WHERE q.status = 'pending')::int  AS pending,
            count(q.id) FILTER (WHERE q.status = 'rejected')::int AS rejected,
            count(DISTINCT s.id) FILTER (WHERE s.active)::int      AS sops
     FROM departments d
     LEFT JOIN questions q ON q.department_id = d.id
     LEFT JOIN sops s ON s.department_id = d.id
     WHERE d.active
     GROUP BY d.name ORDER BY d.name`
  );
  res.json({ target: config.exam.questionsPerDeptBank, departments: r.rows });
});
