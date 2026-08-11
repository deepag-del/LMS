import express, { NextFunction, Request, Response } from "express";
import { config } from "./config";
import { checkDb } from "./db";
import { checkEmail, sendMail } from "./mailer";
import { requireAuth } from "./lib/auth";
import { auth } from "./routes/auth";
import { departments } from "./routes/departments";
import { employees } from "./routes/employees";
import { holidays } from "./routes/holidays";
import { users } from "./routes/users";
import { questions } from "./routes/questions";

const app = express();
app.set("trust proxy", 1); // behind Nginx: report the real client IP in sessions/audit
app.use(express.json());

// ---- Module 3: authentication (login/logout/me are public or self-guarded) ----
app.use(auth);

// Every business route below requires a signed-in session, except the HR
// webhook, which authenticates with its own shared secret instead.
const sessionGate = (req: Request, res: Response, next: NextFunction) =>
  req.path === "/api/admin/employees/webhook" ? next() : requireAuth(req, res, next);

// ---- Modules 2-3: data foundation + user management (role checks inside routes) ----
app.use(sessionGate, departments);
app.use(sessionGate, employees);
app.use(sessionGate, holidays);
app.use(sessionGate, users);

// ---- Module 4: question bank & approval workflow ----
app.use(sessionGate, questions);

// ---- Module 1: health endpoints (used to verify the E2E VM, DBaaS and email are wired up) ----

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "sop-exam-server",
    module: 1,
    env: config.env,
    timezone: config.timezone,
    serverTimeIST: new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
    passMarkPercent: config.exam.passMarkPercent,
  });
});

app.get("/api/health/db", async (_req, res) => {
  const r = await checkDb();
  res.status(r.ok ? 200 : 503).json(r);
});

app.get("/api/health/email", async (_req, res) => {
  const r = await checkEmail();
  res.status(r.ok ? 200 : 503).json(r);
});

// Send one real test email: POST /api/health/email/test {"to": "you@morepenpdr.com"}
app.post("/api/health/email/test", async (req, res) => {
  const to = req.body?.to;
  if (!to) return res.status(400).json({ ok: false, detail: "Provide {\"to\": \"address\"}" });
  try {
    await sendMail(
      to,
      "SOP Exam System — test email",
      "<p>This is a test email from the SOP Compliance Exam Management System (Module 1 setup).</p>"
    );
    res.json({ ok: true, detail: `Test email sent to ${to}` });
  } catch (e) {
    res.status(503).json({ ok: false, detail: (e as Error).message });
  }
});

// Uniform error handler: log server-side, never leak internals to the client.
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ ok: false, detail: "Internal server error" });
});

app.listen(config.port, () => {
  console.log(`sop-exam-server listening on port ${config.port} (TZ=${config.timezone})`);
});
