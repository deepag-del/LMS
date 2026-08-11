import { createHash, randomBytes } from "crypto";
import { NextFunction, Request, Response } from "express";
import { pool } from "../db";

export type Role = "employee" | "manager" | "dept_manager" | "c_level" | "hr_admin" | "qa";

export type SessionUser = {
  id: number;
  employeeId: number | null;
  email: string;
  fullName: string;
  role: Role;
  mustChangePassword: boolean;
};

declare module "express-serve-static-core" {
  interface Request {
    user?: SessionUser;
  }
}

export const SESSION_COOKIE = "sop_session";
const IDLE_TIMEOUT_MIN = 30;   // requirement: 30-minute session timeout
const ABSOLUTE_HOURS = 12;     // hard cap regardless of activity

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Create a session for a user, revoking every other live session
 *  (LOCKED rule: single active session per login). Returns the raw token. */
export async function createSession(userId: number, ip?: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await pool!.query(
    "UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
    [userId]
  );
  await pool!.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at, ip, user_agent)
     VALUES ($1, $2, now() + interval '${ABSOLUTE_HOURS} hours', $3, $4)`,
    [sha256(token), userId, ip ?? null, userAgent ?? null]
  );
  return token;
}

export async function revokeSession(token: string): Promise<void> {
  await pool!.query("UPDATE sessions SET revoked_at = now() WHERE token_hash = $1", [sha256(token)]);
}

async function resolveSession(token: string): Promise<SessionUser | null> {
  const r = await pool!.query(
    `SELECT s.token_hash, s.last_seen_at, u.id, u.employee_id, u.email, u.full_name, u.role, u.must_change_password
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1
       AND s.revoked_at IS NULL
       AND s.expires_at > now()
       AND s.last_seen_at > now() - interval '${IDLE_TIMEOUT_MIN} minutes'
       AND u.active`,
    [sha256(token)]
  );
  if (!r.rowCount) return null;
  await pool!.query("UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1", [
    r.rows[0].token_hash,
  ]);
  const u = r.rows[0];
  return {
    id: u.id,
    employeeId: u.employee_id,
    email: u.email,
    fullName: u.full_name,
    role: u.role,
    mustChangePassword: u.must_change_password,
  };
}

function readToken(req: Request): string | null {
  const cookies = req.headers.cookie;
  if (!cookies) return null;
  for (const part of cookies.split(";")) {
    const [k, v] = part.trim().split("=");
    if (k === SESSION_COOKIE && v) return v;
  }
  return null;
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readToken(req);
  const user = token ? await resolveSession(token) : null;
  if (!user) return res.status(401).json({ ok: false, detail: "Not signed in or session expired" });
  // A user who must change their password may only call auth endpoints.
  if (user.mustChangePassword && !req.path.startsWith("/api/auth/") && req.path !== "/api/me") {
    return res.status(403).json({ ok: false, detail: "Password change required before continuing" });
  }
  req.user = user;
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ ok: false, detail: "Not signed in" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, detail: `Requires role: ${roles.join(" or ")}` });
    }
    next();
  };
}

export function sessionCookie(token: string, secure: boolean): string {
  // Idle timeout is enforced server-side; Max-Age matches the absolute cap.
  return (
    `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${ABSOLUTE_HOURS * 3600}` +
    (secure ? "; Secure" : "")
  );
}

export function clearedSessionCookie(secure: boolean): string {
  return `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0` + (secure ? "; Secure" : "");
}
