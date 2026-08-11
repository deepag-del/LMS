import { useState } from "react";

export default function ChangePasswordPage({ onChanged }: { onChanged: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.detail ?? "Password change failed");
      return;
    }
    onChanged(); // session was revoked server-side; user signs in again
  }

  return (
    <div className="authbox">
      <h1>Set your own password</h1>
      <p className="sub">Your one-time password must be replaced before you continue.
        Minimum 10 characters with letters and numbers.</p>
      <form onSubmit={submit} className="stack">
        <input type="password" required placeholder="Current (one-time) password"
          value={current} onChange={e => setCurrent(e.target.value)} autoFocus />
        <input type="password" required placeholder="New password"
          value={next} onChange={e => setNext(e.target.value)} />
        <input type="password" required placeholder="Confirm new password"
          value={confirm} onChange={e => setConfirm(e.target.value)} />
        <button disabled={busy}>{busy ? "Saving…" : "Change password and sign in again"}</button>
        {error && <p className="fail">{error}</p>}
      </form>
    </div>
  );
}
