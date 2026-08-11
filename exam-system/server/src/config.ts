import dotenv from "dotenv";

dotenv.config();

// All scheduling and timestamps run in IST regardless of server locale (LOCKED rule).
process.env.TZ = process.env.TZ || "Asia/Kolkata";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

export const config = {
  env: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT || 4000),
  timezone: process.env.TZ,

  // E2E DBaaS PostgreSQL connection string, e.g.
  // postgresql://USER:PASSWORD@HOST:5432/sop_exams?sslmode=require
  databaseUrl: process.env.DATABASE_URL || "",

  // --- Email (LOCKED rule: sender swappable in ONE line — change EMAIL_FROM in .env only) ---
  email: {
    from: process.env.EMAIL_FROM || "info@morepenpdr.com",
    fromName: process.env.EMAIL_FROM_NAME || "Morepen SOP Compliance",
    // SMTP works for both SendGrid (smtp.sendgrid.net) and Amazon SES
    // (email-smtp.<region>.amazonaws.com) — switching providers is an .env change only.
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: Number(process.env.SMTP_PORT || 587),
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
  },

  // --- Core business constants (LOCKED rules, configurable in one place) ---
  exam: {
    passMarkPercent: Number(process.env.PASS_MARK_PERCENT || 70),
    durationMinutes: Number(process.env.EXAM_DURATION_MINUTES || 30),
    questionsPerExam: Number(process.env.QUESTIONS_PER_EXAM || 5),
    questionsPerDeptBank: Number(process.env.QUESTIONS_PER_DEPT_BANK || 50),
    examsPerEmployeePerYear: 2,
    retestOffsetDays: Number(process.env.RETEST_OFFSET_DAYS || 7),
  },
};

export { required };
