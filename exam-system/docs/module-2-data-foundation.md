# Module 2 — Data Foundation: How to Use

## What was added

- **Database schema** (`server/migrations/001_data_foundation.sql`): departments, employees, holidays, import runs, and the append-only `audit_log`. The audit log has a database trigger that rejects any UPDATE or DELETE — tamper-proofing enforced by Postgres itself, not just the app. Verified: `UPDATE audit_log …` → `ERROR: audit_log is append-only`.
- **Seeded departments** (locked list): Analytical R&D, MedChem, Process R&D, QA, CADD, NCE, ANDA.
- **Employee roster import** from Excel, with dry-run preview.
- **Two new-hire sync paths**: re-import a partial Excel any time, or point your HR system at a secured webhook.
- **Holiday calendar** with 2026 fixed national holidays pre-seeded, plus the working-day scheduling logic Module 7 will use (unit-tested, 8 cases).
- **Admin UI tabs**: Employees (import + filterable table) and Holidays. No login yet — that is Module 3, so keep the app firewalled to the office network until then.

## Applying the schema on the production VM

```
cd ~/LMS/exam-system/server
git pull
npm install
npm run migrate        # applies any new migrations, records them, safe to re-run
npm run build
pm2 restart sop-exam-server
```

`npm run migrate` prints `applied 001_data_foundation.sql` the first time and `migrations up to date` after.

## Roster import

Template: `exam-system/docs/roster-template.xlsx` (9 sample employees — replace with your real roster). Required columns: **Employee Code, Name, Email, Department**. Optional: Designation, Manager Email, Date of Joining (DD/MM/YYYY or YYYY-MM-DD both work). Header spelling is flexible ("Emp Code", "DOJ", etc.).

Rules enforced on every import:
- Unknown department → row error (never auto-created — a typo would corrupt exam selection).
- Duplicate code/email within the file → row error.
- **Dry run** (the default in the UI) previews created/updated counts and all row errors without writing anything.
- **Add & update** mode: safe for partial files (e.g. just this month's joiners).
- **Full roster** mode: additionally marks active employees *missing from the file* as inactive. Nothing is ever deleted — an ex-employee's exam history must survive for audit.
- Every non-dry-run import is recorded in `import_runs` and the audit log.

## New-hire webhook (for HR system integration)

Set a strong shared secret on the VM: add `WEBHOOK_SECRET=<long random string>` to `server/.env`, then `pm2 restart sop-exam-server`. Generate one with: `openssl rand -hex 32`.

Your HR system (or a scheduled script) then POSTs each joiner:

```
curl -X POST https://exams.morepenpdr.com/api/admin/employees/webhook \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_SECRET" \
  -d '{"employeeCode":"MPD210","fullName":"New Person","email":"new.person@morepenpdr.com","department":"NCE","dateOfJoining":"2026-09-01"}'
```

Responses: `{"ok":true,"result":"created"}` (or `"updated"`). Wrong secret → 401. Secret not configured → webhook stays disabled (503).

## Holiday calendar

Holidays tab → add date + name. Pre-seeded: Republic Day, Independence Day, Gandhi Jayanti 2026. Add the movable festival dates (Holi, Diwali, etc.) once a year. The retest scheduler (Module 7) computes: failure date + 7 calendar days → roll forward past Sat/Sun and every listed holiday.

## Module 2 completion checklist

- [ ] `npm run migrate` succeeded on the production VM
- [ ] Real roster imported (dry run first, then live) — employee count matches HR's number
- [ ] Departments screen shows the right headcount per department
- [ ] 2026 festival holidays added for the remainder of the year
- [ ] `WEBHOOK_SECRET` set if the HR system will push joiners (otherwise plan monthly re-imports)
- [ ] Spot-check: `SELECT actor, action FROM audit_log ORDER BY id` shows your import
