# Build Prompt — Pharma R&D Training & SOP Compliance Portal (LMS)

Copy everything below the line into your AI coding tool (Claude Code, etc.) or hand it to a development team as the requirements brief.

---

## THE PROMPT

Build a web-based **Training & SOP Compliance Portal (LMS)** for a pharmaceutical R&D company with ~200 employees. The portal manages SOP (Standard Operating Procedure) training allocation, online exams, results, and compliance reporting, with role-based access for Employees, HR/Training Admins, Department Heads, and a System Admin.

### 1. Tech Stack (suggested — adjust if needed)
- **Frontend:** React (or Next.js) with a clean, responsive UI (works on desktop and tablet).
- **Backend:** Node.js/Express or Django REST API.
- **Database:** PostgreSQL.
- **Auth:** Email + password login with JWT sessions, "forgot password" flow, and optional SSO hook for later. Passwords hashed with bcrypt.
- Seed the app with realistic **demo data**: ~200 employees across departments (Formulation, Analytical Development, Regulatory Affairs, Quality Assurance, Quality Control, Clinical Research, HR, IT), ~40 SOPs, and sample exams/results so every screen looks populated.

### 2. User Roles & Permissions
| Role | Capabilities |
|---|---|
| **Employee** | Login, view assigned SOPs, read/acknowledge SOPs, take exams, view own results & certificates, see own training status |
| **HR / Training Admin** | Manage employees, allocate SOPs to users/departments/roles, create & schedule exams, view all results, run compliance reports, send reminders |
| **Department Head** | View team's training status, approve training plans, escalate overdue trainings for their department |
| **System Admin** | User & role management, SOP master data, audit log access, system settings |

### 3. Modules

#### 3.1 Employee Login & Profile
- Secure login page with company branding placeholder.
- Employee profile: name, employee ID, department, designation, joining date, reporting manager, photo.
- First-login forced password change; account lockout after 5 failed attempts.
- Session timeout after 15 minutes of inactivity (compliance requirement).

#### 3.2 SOP Management & Allocation
- SOP master list: SOP number, title, version, effective date, review date, department, category, status (Draft / Effective / Superseded / Retired), attached PDF.
- **Version control:** uploading a new version supersedes the old one and automatically re-triggers training assignment for all affected employees.
- **Allocation engine:** HR assigns SOPs to (a) individual employees, (b) entire departments, (c) job roles (e.g., all "Analysts"), with a due date and mandatory/optional flag.
- New joiner rule: onboarding automatically assigns the department's mandatory SOP set with a 30-day due date.
- Employee must open and read the SOP (track "read" status + timestamp) before the exam unlocks. Capture an electronic acknowledgment ("I have read and understood this SOP") with timestamp — styled as a 21 CFR Part 11-inspired e-signature step (re-enter password to sign).

#### 3.3 Exam / Assessment Module
- Question bank per SOP: MCQ (single & multiple answer), true/false. Admin can add/edit/import questions (CSV import).
- Exam configuration: number of questions (randomly drawn from the bank), duration, passing score (default 80%), max attempts (default 3), shuffle questions & options.
- Exam player: timer, one question per screen or scrollable list, auto-submit on timeout, resume protection (no back-door retakes).
- After max failed attempts → status "Retraining Required," notify HR and the employee's manager.

#### 3.4 Results & Certificates
- Instant scoring with pass/fail, percentage, attempt number, and per-question review (configurable: show/hide correct answers).
- Auto-generated **training certificate** (PDF) on passing: employee name, SOP number & version, score, date, unique certificate ID.
- Employee "My Results" page: full history of attempts across all SOPs.
- HR results view: filter by employee, department, SOP, date range, pass/fail; export to Excel/CSV.

#### 3.5 HR / Admin View
- Employee directory with add/edit/deactivate, bulk import via CSV.
- Allocation dashboard: who is assigned what, status (Not Started / SOP Read / Exam Pending / Passed / Failed / Overdue).
- **Training Matrix** (critical for pharma audits): grid of Employees × SOPs showing compliance status per cell, filterable by department, exportable.
- Reminder engine: automatic email notifications at assignment, 7 days before due, on due date, and when overdue; manual "nudge" button for HR.
- Reports: department compliance %, overdue list, new-joiner onboarding status, retraining list, SOP version-change retraining status — all exportable (Excel/PDF).

#### 3.6 Dashboards
**Employee dashboard:**
- My pending trainings (with due dates, color-coded urgency)
- My completed trainings & certificates
- Overall personal compliance score
- Upcoming exams / retraining alerts

**HR/Admin dashboard:**
- Company-wide compliance % (target vs. actual), trend over last 12 months
- Department-wise compliance bar chart
- Overdue trainings count with drill-down list
- Recently effective SOPs and their retraining progress
- Exam pass-rate stats and hardest SOPs (lowest average scores)
- New joiners in onboarding and their progress

**Department Head dashboard:**
- Team compliance summary, individual overdue members, escalation actions

#### 3.7 Audit Trail (pharma compliance)
- Immutable log of every significant action: login/logout, SOP read acknowledgments, exam start/submit, score, allocation changes, SOP version changes, user management actions — with user, timestamp, and before/after values where relevant.
- Audit log viewer for System Admin with filters and export.

#### 3.8 Notifications
- In-app notification bell + email notifications (use a mailer stub/console output for the demo).
- Events: new assignment, due-date reminders, exam result, retraining required, SOP version update.

### 4. Non-Functional Requirements
- Role-based route guards on both frontend and API.
- All timestamps stored in UTC, displayed in local time.
- Responsive layout; usable on lab tablets.
- Clean seed script + README with setup/run instructions and demo credentials for one user of each role.

### 5. Deliverables
1. Working application with all modules above and seeded demo data.
2. README: setup, run, demo logins (employee / HR / dept head / admin).
3. Brief data model diagram (entities: User, Department, SOP, SOPVersion, Allocation, Exam, Question, Attempt, Result, Certificate, AuditLog, Notification).

Build it module by module in this order: auth & roles → employee/SOP masters → allocation → exam engine → results/certificates → dashboards → audit trail → notifications. After each module, ensure the app runs end-to-end.

---

## What else you should consider for the dashboard (beyond your list)

Your list (HR view, SOP allocation, exam, results, employee login) covers the core. For a pharma R&D company, auditors (WHO-GMP, USFDA, ISO) will also expect:

1. **Training Matrix (Employee × SOP grid)** — the #1 thing auditors ask for.
2. **Audit trail** — who did what, when; immutable.
3. **SOP version control with auto-retraining** — when an SOP is revised, everyone trained on the old version must be retrained.
4. **E-signature style acknowledgment** — "read & understood" with password re-entry (21 CFR Part 11 flavor).
5. **Certificates with unique IDs** — printable proof of training.
6. **Due dates, reminders & overdue escalation** — compliance dies without automated follow-up.
7. **New joiner onboarding automation** — auto-assign the department's mandatory SOP set.
8. **Retraining workflow** — after exam failures or SOP revision.
9. **Department Head view** — managers accountable for their team's compliance.
10. **Compliance % KPIs and trends** — company, department, and individual level.
11. **Export everything** — Excel/PDF exports for audit submissions.
12. **Session timeout & account lockout** — standard expectations in regulated environments.
