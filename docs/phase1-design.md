# Phase 1 Design Proposal — Prisma Schema & API Routes

Status: **for review** — per `docs/claude-code-prompt.md`, no application code is written until this is approved.

Sources: `docs/SOP-EHS-001-lab-safety.md` (§5.7 incident timelines, §5.8 training, §5.9 inspections), `docs/requirements.md`, `dashboard/index.html`.

## Design decisions (summary)

1. **Full schema now, Phase 1 endpoints only.** All Phase 2/3 entities (training, chemicals/SDS, inspections, CAPA) are included as tables in the initial migration so later phases add UI + endpoints, not migrations. Only the incident module, dashboard, auth, and admin get API routes in Phase 1.
2. **SLA timestamps are stored, overdue is computed.** `ackDueAt` (= reported + 24 h) and `investigationDueAt` (= reported + 7 *working* days, weekend-aware helper) are set at creation; "overdue" flags are derived in queries so they are always current, never stale.
3. **Anonymous reporting** keeps `reporterId` nullable + `isAnonymous` flag. The audit log records the session user for accountability (SOP §5.7 requires reporting; requirements §2.1 wants anonymity *toward other users*, not toward the compliance record). List/detail endpoints redact reporter identity for everyone below EHS Officer.
4. **Workflow is a server-side state machine** (`Reported → UnderInvestigation → CapaAssigned → Closed`) enforced in one service with an allowed-transitions map; every transition writes `IncidentStatusHistory` + `AuditLog`. Closing requires classification + root cause present, and ≥ 1 CAPA unless closed as near-miss with justification.
5. **Audit trail is append-only:** inserts only, no update/delete paths in code, plus a Postgres trigger blocking `UPDATE/DELETE` on the table. `signatureMeaning`/`signedAt` columns exist now (null in Phase 1) so Part 11-style e-signatures slot in during Phase 3 without altering the table.
6. **Auth:** email/password (argon2) with session cookie via a NestJS Passport *local* strategy; the guard chain (`AuthGuard → RolesGuard`) is strategy-agnostic so an OIDC (Entra ID) strategy can be swapped in without touching controllers. 30-min rolling session timeout (requirements §1).
7. **Photos/SDS in MinIO** via presigned URLs; DB stores object keys only.

## Prisma schema (proposed)

```prisma
// ---------- enums ----------
enum Role       { EMPLOYEE LAB_MANAGER EHS_OFFICER QA ADMIN }
enum IncidentType { INJURY CHEMICAL_SPILL FIRE PROPERTY_DAMAGE NEAR_MISS ILLNESS OTHER }
enum Severity   { LOW MEDIUM HIGH CRITICAL }
enum IncidentStatus { REPORTED UNDER_INVESTIGATION CAPA_ASSIGNED CLOSED }
enum IncidentClassification { NEAR_MISS FIRST_AID RECORDABLE LOST_TIME } // SOP §5.7.2
enum CapaStatus { OPEN IN_PROGRESS COMPLETED VERIFIED_EFFECTIVE CANCELLED }
enum CapaSource { INCIDENT INSPECTION AUDIT }
enum TrainingStatus { ASSIGNED COMPLETED OVERDUE WAIVED }          // Phase 2
enum InspectionStatus { SCHEDULED IN_PROGRESS COMPLETED }          // Phase 3
enum FindingStatus { OPEN CLOSED }                                 // Phase 3

// ---------- core ----------
model User {
  id           String   @id @default(uuid())
  email        String   @unique
  name         String
  passwordHash String?          // null once OIDC-only
  oidcSubject  String?  @unique // Entra ID subject, Phase 2+
  role         Role
  labId        String?          // home lab/department
  lab          Lab?     @relation(fields: [labId], references: [id])
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  reportedIncidents Incident[] @relation("reporter")
  ownedCapas        Capa[]     @relation("capaOwner")
  trainingRecords   TrainingRecord[]
  auditLogs         AuditLog[]
}

model Lab {
  id        String  @id @default(uuid())
  code      String  @unique   // e.g. SYN, ADL, FRM, STB (SOP §2)
  name      String            // Synthesis, Analytical, Formulation, Stability
  isActive  Boolean @default(true)
  users     User[]
  incidents Incident[]
  chemicals ChemicalInventoryItem[]
  inspections Inspection[]
}

// ---------- incidents (Phase 1) ----------
model Incident {
  id             String   @id @default(uuid())
  referenceNo    String   @unique            // e.g. INC-2026-0042, seq per year
  type           IncidentType
  severity       Severity
  status         IncidentStatus @default(REPORTED)
  classification IncidentClassification?     // set by EHS during investigation
  labId          String
  lab            Lab      @relation(fields: [labId], references: [id])
  occurredAt     DateTime
  reportedAt     DateTime @default(now())
  description    String
  immediateAction String?
  isAnonymous    Boolean  @default(false)
  reporterId     String?                     // null when anonymous
  reporter       User?    @relation("reporter", fields: [reporterId], references: [id])

  // SLA (SOP §5.7): ack ≤ 24 h, investigation ≤ 7 working days
  ackDueAt           DateTime
  acknowledgedAt     DateTime?
  acknowledgedById   String?
  investigationDueAt DateTime
  investigationDoneAt DateTime?
  closedAt           DateTime?
  closedById         String?

  photos        IncidentPhoto[]
  investigation Investigation?
  capas         Capa[]
  statusHistory IncidentStatusHistory[]

  @@index([labId, status])
  @@index([occurredAt])
}

model IncidentPhoto {
  id         String   @id @default(uuid())
  incidentId String
  incident   Incident @relation(fields: [incidentId], references: [id])
  objectKey  String              // MinIO key
  fileName   String
  contentType String
  sizeBytes  Int
  uploadedById String?
  createdAt  DateTime @default(now())
}

model Investigation {                        // 1:1 with Incident; 5-Why (SOP §5.7.2)
  id         String   @id @default(uuid())
  incidentId String   @unique
  incident   Incident @relation(fields: [incidentId], references: [id])
  why1       String?
  why2       String?
  why3       String?
  why4       String?
  why5       String?
  rootCause  String?
  notes      String?
  investigatorId String?
  updatedAt  DateTime @updatedAt
}

model IncidentStatusHistory {
  id         String   @id @default(uuid())
  incidentId String
  incident   Incident @relation(fields: [incidentId], references: [id])
  fromStatus IncidentStatus?
  toStatus   IncidentStatus
  changedById String?
  reason     String?
  createdAt  DateTime @default(now())

  @@index([incidentId, createdAt])
}

// ---------- CAPA (schema now; UI Phase 3, dashboard counts Phase 1) ----------
model Capa {
  id          String   @id @default(uuid())
  referenceNo String   @unique              // CAPA-2026-0007
  source      CapaSource
  incidentId  String?
  incident    Incident? @relation(fields: [incidentId], references: [id])
  findingId   String?  @unique
  finding     InspectionFinding? @relation(fields: [findingId], references: [id])
  description String
  actionType  String                        // corrective | preventive
  ownerId     String
  owner       User     @relation("capaOwner", fields: [ownerId], references: [id])
  dueDate     DateTime
  status      CapaStatus @default(OPEN)
  completedAt DateTime?
  effectivenessCheck String?                // Phase 3
  escalatedAt DateTime?                     // monthly Site-Head escalation (SOP §5.7.3)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([status, dueDate])
}

// ---------- training (Phase 2 tables, seeded in Phase 1 for the dashboard) ----------
model TrainingCourse {
  id        String  @id @default(uuid())
  code      String  @unique   // EHS-IND, CHEM-HAND, FIRE, SPILL, FIRSTAID, SOP-EHS-001
  title     String
  validityMonths Int?         // null = one-time; 12 = annual refresher (SOP §5.8.2)
  isActive  Boolean @default(true)
  requirements TrainingRequirement[]
  records      TrainingRecord[]
}

model TrainingRequirement {   // role × course matrix (requirements §2.2)
  id       String @id @default(uuid())
  role     Role
  courseId String
  course   TrainingCourse @relation(fields: [courseId], references: [id])
  @@unique([role, courseId])
}

model TrainingRecord {
  id          String   @id @default(uuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  courseId    String
  course      TrainingCourse @relation(fields: [courseId], references: [id])
  status      TrainingStatus @default(ASSIGNED)
  dueDate     DateTime
  completedAt DateTime?
  score       Int?
  evidenceKey String?          // MinIO key, Phase 2
  @@unique([userId, courseId, dueDate])
  @@index([status, dueDate])
}

// ---------- chemicals & SDS (Phase 3 tables) ----------
model SdsDocument {
  id        String   @id @default(uuid())
  chemicalName String
  casNumber String?
  version   Int      @default(1)
  objectKey String
  publishedById String?
  publishedAt DateTime @default(now())
  isCurrent Boolean  @default(true)
  items     ChemicalInventoryItem[]
  @@index([casNumber])
}

model ChemicalInventoryItem {
  id          String   @id @default(uuid())
  labId       String
  lab         Lab      @relation(fields: [labId], references: [id])
  name        String
  casNumber   String?
  quantity    Decimal
  unit        String
  hazardClass String?             // GHS class / pictogram codes
  location    String?
  expiryDate  DateTime?
  peroxideTestDueAt DateTime?     // SOP §5.3.6 / Annexure 3
  sdsId       String?
  sds         SdsDocument? @relation(fields: [sdsId], references: [id])
  updatedAt   DateTime @updatedAt
  @@index([labId])
}

// ---------- inspections (Phase 3 tables) ----------
model ChecklistTemplate {
  id       String @id @default(uuid())
  name     String                 // weekly walkthrough, monthly EHS (SOP §5.9)
  cadence  String                 // WEEKLY | MONTHLY | ANNUAL
  isActive Boolean @default(true)
  items    ChecklistItem[]
  inspections Inspection[]
}

model ChecklistItem {
  id         String @id @default(uuid())
  templateId String
  template   ChecklistTemplate @relation(fields: [templateId], references: [id])
  order      Int
  text       String
}

model Inspection {
  id          String   @id @default(uuid())
  templateId  String
  template    ChecklistTemplate @relation(fields: [templateId], references: [id])
  labId       String
  lab         Lab      @relation(fields: [labId], references: [id])
  inspectorId String
  status      InspectionStatus @default(SCHEDULED)
  scheduledFor DateTime
  completedAt DateTime?
  findings    InspectionFinding[]
}

model InspectionFinding {
  id           String  @id @default(uuid())
  inspectionId String
  inspection   Inspection @relation(fields: [inspectionId], references: [id])
  description  String
  severity     Severity
  photoKey     String?
  ownerId      String?
  dueDate      DateTime?
  status       FindingStatus @default(OPEN)
  capa         Capa?
}

// ---------- audit trail (Phase 1, append-only) ----------
model AuditLog {
  id         BigInt   @id @default(autoincrement())
  userId     String?             // null for system/anonymous-session actions
  user       User?    @relation(fields: [userId], references: [id])
  action     String              // CREATE | UPDATE | STATUS_CHANGE | LOGIN | EXPORT ...
  entityType String              // "Incident", "Capa", ...
  entityId   String
  before     Json?
  after      Json?
  ipAddress  String?
  // Part 11 e-signature slots, unused until Phase 3:
  signatureMeaning String?       // e.g. "Approved incident closure"
  signedAt         DateTime?
  createdAt  DateTime @default(now())

  @@index([entityType, entityId])
  @@index([createdAt])
}
```

Plus a raw-SQL migration step: `CREATE RULE`/trigger denying `UPDATE`/`DELETE` on `"AuditLog"`, and yearly sequences for `referenceNo`.

## API routes (NestJS, prefix `/api/v1`)

All routes behind `AuthGuard` except `POST /auth/login` and `GET /health`. RBAC via `@Roles()` + `RolesGuard`, enforced server-side. QA role = read-only: `RolesGuard` rejects QA on every mutating route globally.

### Auth
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/auth/login` | public | email+password → httpOnly session cookie |
| POST | `/auth/logout` | any | |
| GET | `/auth/me` | any | current user + role, drives frontend nav |

### Admin
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/users` | ADMIN, EHS_OFFICER, QA | paginated |
| POST | `/users` | ADMIN | |
| PATCH | `/users/:id` | ADMIN | role change, deactivate |
| GET | `/labs` | any | lab picker for forms/filters |
| POST / PATCH | `/labs`, `/labs/:id` | ADMIN | |

### Incidents & near-misses
| Method | Path | Roles | Notes |
|---|---|---|---|
| POST | `/incidents` | any authenticated | sets `ackDueAt`, `investigationDueAt`; honors `isAnonymous` |
| GET | `/incidents` | any (scoped) | Employee sees own + own-lab non-anonymous summaries; Lab Manager sees own lab; EHS/QA/Admin see all. Filters: `labId, status, type, severity, from, to, overdue` |
| GET | `/incidents/:id` | scoped as above | reporter redacted when anonymous, except for EHS/Admin audit view |
| POST | `/incidents/:id/acknowledge` | LAB_MANAGER (own lab), EHS_OFFICER | stops 24 h SLA clock |
| POST | `/incidents/:id/transitions` | EHS_OFFICER | body `{ to, reason }`; state machine validates; writes history + audit |
| PUT | `/incidents/:id/investigation` | EHS_OFFICER | 5-Why fields, root cause, classification |
| POST | `/incidents/:id/photos` | reporter or EHS | returns MinIO presigned PUT; confirm registers row |
| GET | `/incidents/:id/photos/:photoId` | scoped | presigned GET redirect |
| POST | `/incidents/:id/capas` | EHS_OFFICER | create CAPA linked to incident |

### CAPAs (minimal — full UI is Phase 3)
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/capas` | LAB_MANAGER+, QA | filters: `status, overdue, ownerId` — feeds KPI + "my actions" |
| PATCH | `/capas/:id` | EHS_OFFICER, owner (status/notes only) | |

### Dashboard (all accept `from`, `to`, `labId` filters)
| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard/kpis` | days since last recordable, open incidents (+overdue count), training compliance %, open/overdue CAPAs, inspections completed |
| GET | `/dashboard/incidents-by-month` | incidents vs near-misses series (prototype chart 1) |
| GET | `/dashboard/incidents-by-type` | prototype chart 2 |
| GET | `/dashboard/training-compliance` | % by lab vs 95% target (prototype chart 3); Phase 1 computes from **seeded** TrainingRecord data — real data arrives in Phase 2 |
| GET | `/dashboard/recent-incidents` | table under the charts in the prototype |

Every chart endpoint returns plain tabular JSON so the frontend renders both the chart and its accessible fallback table from one payload.

### Audit & misc
| Method | Path | Roles | Notes |
|---|---|---|---|
| GET | `/audit` | QA, ADMIN | filters + CSV export (`Accept: text/csv`) |
| GET | `/health` | public | liveness for Docker/CI |

## Seed data

5 roles → 8 demo users (1 admin, 1 site head-as-admin, 2 EHS, 2 lab managers, 1 QA, 1 employee… plus bulk employees for compliance %), 4 labs (Synthesis, Analytical, Formulation, Stability), 6 training courses per SOP §5.8, requirement matrix, training records tuned so the dashboard shows one lab below the 95% target (matches prototype), ~30 incidents/near-misses spread over 8 months, 7 open CAPAs (2 overdue) to reproduce the prototype's KPI row.

## Test plan (Phase 1, per prompt §6)

- **Unit:** state-machine transition table (every legal/illegal pair), close-gating rules, SLA due-date calculator incl. weekend rollover, RBAC guard matrix (role × route class), anonymous redaction.
- **E2E (Playwright):** login as employee → report incident with photo → login as EHS → acknowledge + transition → incident visible on dashboard with updated KPI.
- **CI:** GitHub Actions — lint, typecheck, unit tests (API + web), spin up Postgres service container for Prisma tests, then the single E2E happy path.

## Open questions (defaults chosen, flag if wrong)

1. **Working days** for the 7-day investigation SLA: assumed Mon–Sat is *not* right for every site — I've assumed **Mon–Fri**, no holiday calendar in Phase 1.
2. **Anonymous reports and audit:** audit log stores the real session user even for anonymous reports (redacted in UI below EHS). If true anonymity is required, say so and I'll drop the linkage.
3. **Lab Manager acknowledgment scope:** assumed a Lab Manager may acknowledge only incidents in their own lab; EHS can acknowledge anywhere.
