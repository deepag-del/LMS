import { Router } from "express";
import { pool } from "../db";
import { audit } from "../lib/audit";
import { requireRole, Role } from "../lib/auth";
import { generateTempPassword, hashPassword } from "../lib/passwords";
import { sendMail } from "../mailer";
import { config } from "../config";

export const users = Router();

const ROLES: Role[] = ["employee", "manager", "dept_manager", "c_level", "hr_admin", "qa"];

users.get("/api/users", requireRole("hr_admin", "qa"), async (_req, res) => {
  const r = await pool!.query(
    `SELECT u.id, u.email, u.full_name, u.role, u.active, u.must_change_password,
            u.employee_id, e.employee_code, d.name AS department
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     LEFT JOIN departments d ON d.id = e.department_id
     ORDER BY u.full_name`
  );
  res.json(r.rows);
});

// Provision a login for an employee (or a non-roster account like an auditor).
// Generates a one-time password; emails it if SMTP is configured, otherwise
// returns it ONCE in the response for HR to hand over securely.
users.post("/api/users/provision", requireRole("hr_admin"), async (req, res) => {
  const { employeeId, email, fullName, role } = req.body ?? {};
  if (!ROLES.includes(role)) {
    return res.status(400).json({ ok: false, detail: `role must be one of: ${ROLES.join(", ")}` });
  }

  let resolvedEmail = email, resolvedName = fullName, resolvedEmployeeId: number | null = null;
  if (employeeId) {
    const e = await pool!.query(
      "SELECT id, full_name, email FROM employees WHERE id = $1 AND status = 'active'",
      [employeeId]
    );
    if (!e.rowCount) return res.status(400).json({ ok: false, detail: "Active employee not found" });
    resolvedEmail = e.rows[0].email;
    resolvedName = e.rows[0].full_name;
    resolvedEmployeeId = e.rows[0].id;
  }
  if (!resolvedEmail || !resolvedName) {
    return res.status(400).json({ ok: false, detail: "Provide employeeId, or email + fullName" });
  }

  const existing = await pool!.query("SELECT id FROM users WHERE lower(email) = lower($1)", [resolvedEmail]);
  if (existing.rowCount) {
    return res.status(409).json({ ok: false, detail: `A login already exists for ${resolvedEmail}` });
  }

  const temp = generateTempPassword();
  const r = await pool!.query(
    `INSERT INTO users (employee_id, email, full_name, role, password_hash, must_change_password)
     VALUES ($1, $2, $3, $4, $5, true) RETURNING id`,
    [resolvedEmployeeId, resolvedEmail, resolvedName, role, hashPassword(temp)]
  );
  await audit("user.provisioned", "user", String(r.rows[0].id),
    { email: resolvedEmail, role, employeeId: resolvedEmployeeId }, req.user!.email);

  let delivery: string;
  if (config.email.smtpHost) {
    try {
      await sendMail(
        resolvedEmail,
        "Your SOP Compliance Exam System account",
        `<p>Hello ${resolvedName},</p>
         <p>An account has been created for you on the SOP Compliance Exam Management System.</p>
         <p>Sign in with your company email and this one-time password: <strong>${temp}</strong></p>
         <p>You will be asked to set your own password on first sign-in. This password expires after first use.</p>`
      );
      delivery = "emailed";
      return res.status(201).json({ ok: true, userId: r.rows[0].id, delivery });
    } catch {
      delivery = "email_failed_shown_once";
    }
  } else {
    delivery = "shown_once";
  }
  // No (working) SMTP: show the temp password exactly once so HR can pass it on.
  res.status(201).json({ ok: true, userId: r.rows[0].id, delivery, tempPassword: temp });
});

users.post("/api/users/:id/reset-password", requireRole("hr_admin"), async (req, res) => {
  const temp = generateTempPassword();
  const r = await pool!.query(
    `UPDATE users SET password_hash = $2, must_change_password = true,
            failed_attempts = 0, locked_until = NULL, updated_at = now()
     WHERE id = $1 RETURNING email, full_name`,
    [req.params.id, hashPassword(temp)]
  );
  if (!r.rowCount) return res.status(404).json({ ok: false, detail: "User not found" });
  await pool!.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [req.params.id]);
  await audit("user.password_reset", "user", req.params.id, { by: req.user!.email }, req.user!.email);

  if (config.email.smtpHost) {
    try {
      await sendMail(r.rows[0].email, "SOP Exam System — password reset",
        `<p>Hello ${r.rows[0].full_name},</p><p>Your password was reset. One-time password: <strong>${temp}</strong></p>`);
      return res.json({ ok: true, delivery: "emailed" });
    } catch { /* fall through to shown_once */ }
  }
  res.json({ ok: true, delivery: "shown_once", tempPassword: temp });
});

users.patch("/api/users/:id/role", requireRole("hr_admin"), async (req, res) => {
  const { role } = req.body ?? {};
  if (!ROLES.includes(role)) {
    return res.status(400).json({ ok: false, detail: `role must be one of: ${ROLES.join(", ")}` });
  }
  if (Number(req.params.id) === req.user!.id) {
    return res.status(400).json({ ok: false, detail: "You cannot change your own role" });
  }
  const r = await pool!.query(
    "UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING email",
    [req.params.id, role]
  );
  if (!r.rowCount) return res.status(404).json({ ok: false, detail: "User not found" });
  await audit("user.role_changed", "user", req.params.id, { role }, req.user!.email);
  res.json({ ok: true });
});

users.patch("/api/users/:id/active", requireRole("hr_admin"), async (req, res) => {
  const active = Boolean(req.body?.active);
  if (Number(req.params.id) === req.user!.id && !active) {
    return res.status(400).json({ ok: false, detail: "You cannot deactivate your own account" });
  }
  const r = await pool!.query(
    "UPDATE users SET active = $2, updated_at = now() WHERE id = $1 RETURNING email",
    [req.params.id, active]
  );
  if (!r.rowCount) return res.status(404).json({ ok: false, detail: "User not found" });
  if (!active) {
    await pool!.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [req.params.id]);
  }
  await audit(active ? "user.activated" : "user.deactivated", "user", req.params.id, null, req.user!.email);
  res.json({ ok: true });
});
