# Lab Safety Management App — Requirements

Target: small pharmaceutical R&D site, ~200 employees. Modelled on EHS practices common at pharma companies (incident pyramids and TRIR tracking, SDS libraries, permit-to-work, training matrices, CAPA workflows as used across the industry, e.g. by large pharma EHS programs and commercial EHS suites such as Intelex, Enablon, VelocityEHS).

## 1. Users and roles (RBAC)

| Role | Approx. count | Permissions |
|---|---|---|
| Employee | ~180 | Report incidents/near-misses, view own training status, view SDS, complete assigned actions |
| Lab Manager | ~10 | All Employee rights + approve reports for their lab, run weekly inspections, manage lab chemical inventory |
| EHS Officer | 2–3 | Full module access: classify incidents, assign CAPAs, manage training matrix, publish SDS, configure checklists |
| QA / Auditor | 2–3 | Read-only across modules + audit trail export |
| Site Head / Admin | 1–2 | Dashboards, escalation views, user and role administration |

Authentication: SSO (Microsoft Entra ID / Google Workspace) with email fallback; session timeout 30 min; all writes attributed to a named user.

## 2. Functional modules

### 2.1 Incident & near-miss reporting
- Mobile-friendly form: date/time, location (lab picker), type (injury, spill, fire, property damage, near-miss), severity, description, photos, immediate action taken.
- Workflow: Reported → Under Investigation → CAPA Assigned → Closed; SLA timers (report ≤ 24 h, investigation ≤ 7 working days).
- Root-cause capture (5-Why fields) and CAPA linkage.
- Anonymous near-miss option to encourage reporting.

### 2.2 Training & competency (LMS integration)
- Training matrix: role × mandatory courses (induction, chemical handling, fire, spill response, first aid, SOP-EHS-001 read-and-understood).
- Due-date tracking with 30/14/1-day reminders; overdue = flagged non-compliant and surfaced to Lab Manager.
- Evidence: e-sign read-and-understood, quiz scores, attendance upload.

### 2.3 Chemical inventory & SDS library
- Per-lab inventory: name, CAS, quantity, hazard class (GHS pictograms), location, expiry, peroxide-former test date.
- Searchable SDS repository (PDF), version-controlled; every inventory row links to its SDS.
- Alerts: expiry approaching, peroxide test overdue, quantity above flammable-storage limit.

### 2.4 Inspections & audits
- Configurable checklists (weekly lab walkthrough, monthly EHS inspection, extinguisher/eyewash checks).
- Findings with photo, severity, owner, due date; auto-escalation when overdue.

### 2.5 CAPA tracking
- CAPAs from incidents, inspections, or audits; owner, due date, effectiveness check; monthly overdue escalation to Site Head.

### 2.6 Dashboard & reporting
- KPI row: days since last recordable incident, open incidents, training compliance %, open/overdue CAPAs, inspections completed.
- Trends: incidents & near-misses by month; incidents by type; training compliance by department; CAPA aging.
- Filters: date range, lab/department. Exports: CSV and PDF monthly safety report for the Safety Committee.

### 2.7 Notifications
- Email + in-app: new incident (EHS, Lab Manager), CAPA assigned/overdue, training due, inspection scheduled.

## 3. Non-functional requirements

- **Compliance:** full audit trail (who/what/when, before/after values) on all records; e-signature (name + timestamp + meaning) on incident closure and training sign-off — 21 CFR Part 11 / EU Annex 11 aligned; data retention ≥ 5 years.
- **Capacity:** 200 named users, ~50 concurrent; ≤ 500 ms p95 page loads on LAN.
- **Availability:** single-site deployment, daily automated backups, RPO 24 h, RTO 8 h.
- **Security:** TLS everywhere, RBAC enforced server-side, OWASP ASVS L1 baseline, no PHI stored.
- **Platforms:** responsive web app (desktop + mobile browser); no native app required at this scale.

## 4. Suggested stack (for ~200 users, small IT team)

- Frontend: React (Vite) or Next.js, TypeScript.
- Backend: Node.js (NestJS/Express) or Python (FastAPI); PostgreSQL; S3-compatible object storage for photos/SDS PDFs.
- Auth: OIDC via Entra ID; deployment: single VM or small k8s, Docker Compose acceptable.
- Reporting: server-rendered PDF (e.g., Playwright print) + CSV export.

## 5. Phasing

1. **Phase 1 (MVP, ~6 weeks):** incident/near-miss reporting + dashboard + user/role setup.
2. **Phase 2:** training matrix + LMS integration + notifications.
3. **Phase 3:** chemical inventory/SDS + inspections + CAPA workflows + Part 11-style audit trail hardening.
