# Module 3 — Roles & Access: How to Use

## What was added

- **Login with server-side sessions** (httpOnly cookie; token stored only as a SHA-256 hash in the `sessions` table).
- **Single active session per login** (LOCKED integrity rule): signing in anywhere revokes every other live session for that account. Verified: the older browser is signed out the moment the newer one signs in.
- **30-minute idle timeout** + 12-hour absolute session cap, enforced server-side.
- **Six roles** exactly per the brief: Employee, Manager, Dept manager (question author), C-level, HR/Admin, QA (read-only). Role checks are enforced on the server route by route — the UI hiding a button is convenience, not the security boundary.
- **Brute-force protection**: 5 wrong passwords → account locked 15 minutes (right password also rejected while locked; HR reset clears it instantly). Every attempt is in the audit log.
- **Forced password rotation**: accounts are provisioned with a one-time password and must set their own (min 10 chars, letters + digits) before reaching any business screen. Changing a password revokes all sessions.
- **Account provisioning UI** (Users tab, HR/Admin): pick an imported employee + role → one-time password is emailed via `info@morepenpdr.com` if SMTP is configured, otherwise shown exactly once for HR to hand over. Also: reset password, change role, deactivate/reactivate. HR cannot change their own role or deactivate themselves.
- **Audit events**: `auth.login`, `auth.login_failed` (with reason), `auth.password_changed`, `user.provisioned`, `user.password_reset`, `user.role_changed`, `user.deactivated` — all in the append-only `audit_log`.

## Who can do what (as of Module 3)

| Role | Employees list | Roster import | Holidays | Users screen |
|---|---|---|---|---|
| Employee / Manager / Dept manager | — | — | view | — |
| C-level | view | — | view | — |
| QA | view | — | view | view (read-only) |
| HR/Admin | view | yes | manage | manage |

(Exam-related permissions — question authoring, C-level approval, manager reports — activate with Modules 4–9.)

## Production rollout

```bash
ssh examapp@VM_IP
cd ~/LMS/exam-system/server
git pull && npm install && npm run migrate && npm run build
pm2 restart sop-exam-server
cd ../client && npm install && npm run build && sudo cp -r dist/* /var/www/sop-exams/
```

Then bootstrap the first admin (once):

```bash
cd ~/LMS/exam-system/server
npm run create-admin -- your.name@morepenpdr.com "Your Name"
```

It prints a one-time password; sign in at https://exams.morepenpdr.com, set your own, then provision everyone else from the **Users** tab. After confirming login works, you can remove any temporary office-IP restriction from Nginx — the app now has its own front door.

## Module 3 completion checklist

- [ ] `002_auth.sql` applied; `create-admin` run once and the printed password used + rotated
- [ ] Signing in on a second browser signs out the first (single-session rule)
- [ ] A provisioned employee account can sign in, is forced to change password, and **cannot** open Employees/Users or modify holidays
- [ ] QA account (if provisioned) sees everything but has no edit controls, and edits via API are rejected
- [ ] 5 wrong passwords locks the account; HR reset unlocks it
- [ ] `SELECT actor, action FROM audit_log WHERE action LIKE 'auth%'` shows the history
