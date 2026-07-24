# Lab Safety — SOP, Requirements & Dashboard

Lab safety package for a small pharmaceutical R&D site (~200 employees).

## Contents

| Path | What it is |
|---|---|
| `docs/SOP-EHS-001-lab-safety.md` | Standard Operating Procedure for laboratory safety — pharma SOP format (purpose, scope, responsibilities, procedure, annexures, revision history), covering PPE, chemical handling, waste, emergencies, incident/near-miss reporting, training, and inspections. |
| `docs/requirements.md` | Full requirements for the lab safety management app: roles for a 200-employee setup, modules (incidents, training/LMS, chemical inventory & SDS, inspections, CAPA, dashboard), non-functional requirements, suggested stack, and phasing. |
| `docs/claude-code-prompt.md` | A ready-to-paste prompt for Claude Code to build the production app from these documents. |
| `dashboard/index.html` | Working dashboard prototype — self-contained, no build step or dependencies. |

## Dashboard

Open `dashboard/index.html` in any browser. It ships with illustrative demo data and includes:

- KPI row: days since last recordable incident, incidents, near-misses, training compliance vs 95% target, open CAPAs.
- Incidents & near-misses by month (grouped columns), incidents by type, and training compliance by lab, each with a hover tooltip and an accessible data-table view.
- Working filters (6/12-month range, lab selector), light/dark themes (follows the OS, with a manual toggle), and a recent-incidents log tied to the SOP §5.7 workflow states.

## Next step

Paste the contents of `docs/claude-code-prompt.md` into Claude Code to scaffold the Phase 1 production application (incident reporting + dashboard + RBAC) against these requirements.
