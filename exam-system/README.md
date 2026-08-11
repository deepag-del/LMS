# SOP Compliance Exam Management System

Exam management system for SOP compliance at a pharma R&D company (~200 employees), built to FDA/EMA-style audit-readiness expectations: immutable audit trail, controlled question-bank workflow, verifiable certificates.

Built module by module — see the plan and locked business rules in the project brief. **Current status: Module 1 (environment & infrastructure).**

## Stack (and why)

| Layer | Choice | Why |
|---|---|---|
| Backend | **Node.js 22 + Express + TypeScript** | One language across the whole project; TypeScript catches mistakes at compile time — important when scores and audit records must be exactly right. Express is boring and well-documented, which suits a small team maintaining a compliance system for years. |
| Database | **PostgreSQL (E2E DBaaS)** | Managed backups and updates (less server admin for you); Postgres has real transactional integrity, which the immutable audit trail and scoring depend on. |
| Frontend | **React 18 + Vite** | Standard, huge talent pool, fast dev loop. The exam-taking UI (timer, randomized options, blur logging) is a natural fit for React state. |
| Process manager | **PM2** | Keeps the API alive through crashes and VM reboots without container complexity. |
| Web server | **Nginx + Let's Encrypt** | Serves the React build, proxies `/api` to Node, free auto-renewing HTTPS. |
| Email | **SMTP via nodemailer** | The same code works with SendGrid and Amazon SES; provider AND sender address (`info@morepenpdr.com` → `compliance@…` later) are `.env`-only changes. |

Deliberately **not** chosen: Kubernetes/Docker-in-prod (overkill for one VM + managed DB), NestJS (more concepts to learn), serverless (the server-side exam timer wants a long-running process).

## Layout

```
exam-system/
├── server/          Express API (TypeScript). Module 1: health checks for DB + email,
│                    IST timezone enforcement, business constants (70% pass mark etc.)
├── client/          React + Vite frontend. Module 1: infrastructure status page
├── deploy/          docker-compose.dev.yml (LOCAL dev database only) and Nginx config
└── docs/
    └── module-1-e2e-runbook.md   Step-by-step E2E VM + DBaaS + SendGrid setup,
                                  every terminal command explained for beginners
```

## Run locally

```bash
# 1. local database (production uses E2E DBaaS instead)
docker compose -f deploy/docker-compose.dev.yml up -d

# 2. API server
cd server
npm install
cp .env.example .env   # then set DATABASE_URL=postgresql://examuser:localdevpass@localhost:5432/sop_exams
npm run dev            # http://localhost:4000/api/health

# 3. frontend (second terminal)
cd client
npm install
npm run dev            # http://localhost:5173
```

## Deploy to production

Follow `docs/module-1-e2e-runbook.md` — it covers the E2E Networks VM, DBaaS PostgreSQL, Nginx + HTTPS, and morepenpdr.com domain authentication for email, with a completion checklist at the end.

## Module roadmap

1. ✅ Environment & infrastructure (this)
2. Data foundation — employee Excel import, departments, holiday calendar, new-hire sync
3. Roles & access — login + role-based permissions
4. Question bank & approval workflow (SOP-tagged, C-level approval)
5. Selection engine — 2 exams/employee/year, exclusion-after-pass, fresh question sets
6. Exam engine — 30 min server-side timer, 5 randomized questions, session lock
7. Retest scheduler — 7 days out, weekdays only, holiday-aware, slot picker
8. Notifications — all email templates & triggers
9. Manager report — structured dropdown form with escalating reminders
10. Certificates & audit trail — letterhead + stamp, QR verification, immutable log
11. Pilot & go-live
