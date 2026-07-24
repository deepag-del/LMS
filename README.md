# Pharma R&D SOP Exam Portal

A self-contained online exam portal for pharma R&D SOP training and assessment.
No build step, no dependencies — open `index.html` in a browser.

## Views

Toggle **Employee** vs **HR / GL / CXO** at the top of the sidebar.

| # | Page | Employee | Admin |
|---|------|----------|-------|
| 1 | Register | ✅ | — |
| 2 | Login | ✅ | ✅ |
| 3 | SOP Library | ✅ | ✅ |
| 4 | My SOP Allocations | ✅ | — |
| 5 | SOP Allocation (Admin) | — | ✅ |
| 6 | Revision & Retraining Tracker | — | ✅ |
| 7 | Question Bank | — | ✅ |
| 8 | HR Policies | ✅ | ✅ |
| 9 | Tracking Dashboard | — | ✅ |
| 10 | Exam Instructions | ✅ | — |
| 11 | Exam Screen | ✅ | — |
| 12 | My Result | ✅ | — |

## Exam rules

- 5 questions drawn randomly from the SOP's question bank
- 10-minute timer with auto-submit at time-out
- Pass mark 80%; a failed attempt sets the allocation to *Retraining*,
  which surfaces in the admin Revision & Retraining Tracker

## Tracking Dashboard

Stat tiles (compliance %, active SOPs, exams this month, overdue allocations)
plus three charts rendered as dependency-free inline SVG with hover tooltips
and a table view: attempts-vs-passes trend, pass rate by department, and
allocation status by department. Light and dark themes are both supported
(OS preference plus a manual toggle).

## Demo data

SOPs, employees, allocations, and question banks are seeded in `index.html`
as in-memory JavaScript objects — replace them with API calls to wire up a
real backend.
