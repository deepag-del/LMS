# Module 5 — Selection Engine: How to Use

## How the locked rules are implemented

- **2 exams per employee per year** → the year is split into two cycles: **H1 (Jan–Jun)** and **H2 (Jul–Dec)**, computed in IST. Each employee gets exactly one exam assignment per cycle — a `UNIQUE (employee_id, cycle)` constraint in Postgres makes double-selection impossible, not just unlikely.
- **Excluded after pass until the next cycle** → eligibility for selection is "active employee with no non-cancelled assignment this cycle". A passed (or failed-awaiting-retest, or in-progress) assignment blocks reselection; a new cycle starts everyone fresh.
- **Fresh, non-overlapping question set in the 2nd cycle** → implemented in the balanced draw function the exam engine (Module 6) will call: it excludes every question the employee saw earlier in the year, and refuses to run (with a clear "bank too small" error) rather than repeat a question.
- **Random, department-wise, monthly** → each run picks randomly (`ORDER BY random()` in Postgres) per department. Leaving the count empty uses the recommended pace: `remaining ÷ months left in cycle`, so selections spread evenly and every department finishes by cycle end.
- **Balanced draws across SOPs** → the draw groups the department bank by SOP and round-robins across them, so 5 questions span as many different SOPs as possible (unit-tested: 5 SOPs → 5 different SOPs; 2 SOPs → 3/2 split, never 5/0).

## Monthly HR routine (Selection tab)

1. Open **Selection** — the status table shows, per department: active headcount, selected, passed, failed, open, and **still to select** for the current cycle.
2. Click **Preview** (all departments, count empty) — you see exactly who would be picked, nothing saved.
3. Click **Confirm selection** — assignments are created (note: confirm re-draws randomly; the preview shows the shape, not a locked list) and the run is recorded in the audit log.
4. Selected employees see it immediately in their **My exams** tab. (Automatic email notification of selection arrives with Module 8.)
5. If someone leaves or goes on long leave before their exam starts, use **cancel** (reason required, audited) — they return to the eligible pool if reinstated later, and cancelled rows never block a future selection.

QA and C-level see the same screens read-only.

## Production rollout

Standard update (pull → install → `npm run migrate` → build → restart). `004_selection.sql` adds `exam_assignments`.

**Timing note for go-live:** the first real cycle starts at the next half-year boundary, but you can start mid-cycle — the pacing formula automatically compresses (remaining ÷ months left). If you go live in, say, October, H2 selections run at a faster monthly rate and the annual "2 exams" rule is simply pro-rated to one exam for the first partial year — flag it in the pilot review if you'd rather force both.

## Module 5 completion checklist

- [ ] `004_selection.sql` applied
- [ ] Preview → confirm run executed for at least one department; names look sensibly random
- [ ] Re-running a selection never re-picks an already-selected employee
- [ ] A cancelled assignment (with reason) returns the employee to the pool
- [ ] Employee login shows the assignment under **My exams**
- [ ] `SELECT action, details FROM audit_log WHERE action = 'selection.run'` shows each run with per-department counts
- [ ] Question banks approaching 50 approved before Module 6 goes live (the draw refuses to run on a too-small bank)
