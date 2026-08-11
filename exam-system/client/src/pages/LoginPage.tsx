import { useState } from "react";

export default function LoginPage({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.detail ?? "Sign-in failed");
      return;
    }
    onLoggedIn();
  }

  return (
    <div className="authbox">
      <h1>SOP Compliance Exam System</h1>
      <p className="sub">Sign in with your company email</p>
      <form onSubmit={submit} className="stack">
        <input type="email" required placeholder="you@morepenpdr.com"
          value={email} onChange={e => setEmail(e.target.value)} autoFocus />
        <input type="password" required placeholder="Password"
          value={password} onChange={e => setPassword(e.target.value)} />
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        {error && <p className="fail">{error}</p>}
      </form>
      <p className="hint">First time here? HR provisions accounts and gives you a one-time password.
        Forgot yours? Ask HR/Admin for a reset.</p>
    </div>
  );
}
