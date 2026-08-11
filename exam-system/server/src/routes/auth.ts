import { Router } from "express";
import { pool } from "../db";
import { config } from "../config";
import { audit } from "../lib/audit";
import {
  clearedSessionCookie, createSession, requireAuth, revokeSession, sessionCookie, SESSION_COOKIE,
} from "../lib/auth";
import { hashPassword, passwordPolicyError, verifyPassword } from "../lib/passwords";

export const auth = Router();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MIN = 15;
const secureCookies = () => config.env === "production";

auth.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) {
    return res.status(400).json({ ok: false, detail: "Provide email and password" });
  }
  const r = await pool!.query("SELECT * FROM users WHERE lower(email) = lower($1)", [email]);
  const invalid = () => res.status(401).json({ ok: false, detail: "Invalid email or password" });

  if (!r.rowCount) {
    await audit("auth.login_failed", "user", String(email), { reason: "unknown email" }, String(email));
    return invalid();
  }
  const u = r.rows[0];
  if (!u.active) {
    await audit("auth.login_failed", "user", String(u.id), { reason: "account inactive" }, u.email);
    return invalid();
  }
  if (u.locked_until && new Date(u.locked_until) > new Date()) {
    await audit("auth.login_failed", "user", String(u.id), { reason: "locked out" }, u.email);
    return res.status(423).json({
      ok: false,
      detail: `Account temporarily locked after repeated failures. Try again after ${LOCKOUT_MIN} minutes or ask HR to reset your password.`,
    });
  }
  if (!verifyPassword(password, u.password_hash)) {
    const attempts = u.failed_attempts + 1;
    const lock = attempts >= MAX_ATTEMPTS;
    await pool!.query(
      `UPDATE users SET failed_attempts = $2,
              locked_until = CASE WHEN $3 THEN now() + interval '${LOCKOUT_MIN} minutes' ELSE locked_until END,
              updated_at = now()
       WHERE id = $1`,
      [u.id, lock ? 0 : attempts, lock]
    );
    await audit("auth.login_failed", "user", String(u.id), { reason: "wrong password", attempts, locked: lock }, u.email);
    return lock
      ? res.status(423).json({ ok: false, detail: `Too many failed attempts — account locked for ${LOCKOUT_MIN} minutes.` })
      : invalid();
  }

  await pool!.query("UPDATE users SET failed_attempts = 0, locked_until = NULL, updated_at = now() WHERE id = $1", [u.id]);
  const token = await createSession(u.id, req.ip, req.get("user-agent") ?? undefined);
  await audit("auth.login", "user", String(u.id), { singleActiveSession: true }, u.email);
  res.setHeader("Set-Cookie", sessionCookie(token, secureCookies()));
  res.json({
    ok: true,
    user: { email: u.email, fullName: u.full_name, role: u.role, mustChangePassword: u.must_change_password },
  });
});

auth.post("/api/auth/logout", async (req, res) => {
  const cookie = req.headers.cookie ?? "";
  const token = cookie.split(";").map(s => s.trim()).find(s => s.startsWith(`${SESSION_COOKIE}=`))?.split("=")[1];
  if (token) await revokeSession(token);
  res.setHeader("Set-Cookie", clearedSessionCookie(secureCookies()));
  res.json({ ok: true });
});

auth.get("/api/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

auth.post("/api/auth/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ ok: false, detail: "Provide currentPassword and newPassword" });
  }
  const policy = passwordPolicyError(newPassword);
  if (policy) return res.status(400).json({ ok: false, detail: policy });

  const r = await pool!.query("SELECT password_hash FROM users WHERE id = $1", [req.user!.id]);
  if (!verifyPassword(currentPassword, r.rows[0].password_hash)) {
    return res.status(401).json({ ok: false, detail: "Current password is incorrect" });
  }
  await pool!.query(
    "UPDATE users SET password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1",
    [req.user!.id, hashPassword(newPassword)]
  );
  // Password change invalidates every session; the user signs in again.
  await pool!.query("UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [req.user!.id]);
  await audit("auth.password_changed", "user", String(req.user!.id), null, req.user!.email);
  res.setHeader("Set-Cookie", clearedSessionCookie(secureCookies()));
  res.json({ ok: true, detail: "Password changed — please sign in again" });
});
