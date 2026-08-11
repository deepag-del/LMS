import { useEffect, useState } from "react";

type Health = {
  ok: boolean;
  service: string;
  timezone: string;
  serverTimeIST: string;
  passMarkPercent: number;
};

type Check = { ok: boolean; detail: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [db, setDb] = useState<Check | null>(null);
  const [email, setEmail] = useState<Check | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/health")
      .then(r => r.json())
      .then(setHealth)
      .catch(() => setError("API server is not reachable — is the server running on port 4000?"));
    fetch("/api/health/db").then(r => r.json()).then(setDb).catch(() => {});
    fetch("/api/health/email").then(r => r.json()).then(setEmail).catch(() => {});
  }, []);

  const badge = (c: Check | null) =>
    c === null ? <span className="pending">checking…</span>
    : c.ok ? <span className="ok">OK</span>
    : <span className="fail">NOT CONFIGURED</span>;

  return (
    <main>
      <h1>SOP Compliance Exam Management System</h1>
      <p className="sub">Morepen R&amp;D · Module 1 — environment &amp; infrastructure check</p>
      {error && <p className="fail">{error}</p>}
      {health && (
        <ul className="checks">
          <li><strong>API server</strong> <span className="ok">OK</span> — {health.service}, timezone {health.timezone}, server time (IST) {health.serverTimeIST}</li>
          <li><strong>Database (E2E DBaaS)</strong> {badge(db)}{db && <> — {db.detail}</>}</li>
          <li><strong>Email (SendGrid/SES)</strong> {badge(email)}{email && <> — {email.detail}</>}</li>
          <li><strong>Pass mark constant</strong> <span className="ok">{health.passMarkPercent}%</span></li>
        </ul>
      )}
      <p className="sub">When all rows show OK, Module 1 is complete. Modules 2–11 replace this page with the real application.</p>
    </main>
  );
}
