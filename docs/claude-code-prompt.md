# Prompt for Claude Code — Build the Lab Safety Management App

Copy everything below the line into Claude Code (claude.ai/code or the CLI) from the root of this repository.

---

You are building a **Lab Safety Management web application** for a small pharmaceutical R&D site with ~200 employees. The repository already contains the governing documents — read them first and treat them as the source of truth:

- `docs/SOP-EHS-001-lab-safety.md` — the Lab Safety SOP the app must operationalize (incident reporting timelines, training rules, inspection cadence, CAPA escalation).
- `docs/requirements.md` — full functional and non-functional requirements, roles, and phasing.
- `dashboard/index.html` — an approved static prototype of the dashboard; match its layout, KPIs, chart types, and light/dark theming in the production app.

## What to build (Phase 1 MVP first)

1. **Scaffold** a monorepo: `apps/web` (Next.js + TypeScript) and `apps/api` (NestJS + TypeScript + Prisma + PostgreSQL). Use Docker Compose for local dev (Postgres + MinIO for photo/SDS storage). Seed script creates the 5 roles and demo users.
2. **Auth & RBAC:** OIDC-ready auth (start with email/password + seeded users, structured so Entra ID can be swapped in). Enforce roles server-side: Employee, Lab Manager, EHS Officer, QA (read-only), Admin.
3. **Incident & near-miss module:** mobile-friendly report form (type, severity, lab, description, photos, immediate action, optional anonymous flag); workflow states Reported → Under Investigation → CAPA Assigned → Closed; 5-Why root-cause fields; SLA timers (24 h report acknowledgment, 7-working-day investigation) with overdue flags.
4. **Dashboard:** implement the prototype's KPI row (days since last recordable, open incidents, training compliance %, open CAPAs, inspections done) and charts (incidents vs near-misses by month, incidents by type, training compliance by department) with date-range and lab filters, light/dark themes, and a data-table fallback for every chart.
5. **Audit trail:** append-only audit log on every create/update (user, timestamp, entity, before/after JSON) — design it now so Part 11-style e-signatures can be added in Phase 3.
6. **Tests & CI:** unit tests for workflow transitions and RBAC guards, one Playwright happy-path E2E (report an incident → see it on the dashboard), GitHub Actions workflow running lint + tests.

## Constraints

- Follow `docs/requirements.md` §3 for non-functional requirements (500 ms p95, 50 concurrent users, TLS, OWASP ASVS L1).
- Every chart needs an accessible fallback table and must work in both color themes.
- Keep the stack boring and maintainable for a 1–2 person IT team; no microservices.
- Do not implement Phase 2/3 modules (training matrix, chemical inventory, inspections, CAPA UI) yet — but design the Prisma schema so they can be added without migration pain (include the entities as tables now if that's cleaner).
- Commit in logical increments with clear messages; write a `README.md` covering setup, seed data, and how to run tests.

Start by reading the three documents above, then propose the Prisma schema and the API route list for my review before writing application code.
