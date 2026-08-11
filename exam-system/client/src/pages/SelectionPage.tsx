import { useCallback, useEffect, useState } from "react";

type Status = {
  cycle: string;
  monthsRemaining: number;
  departments: {
    department: string; active_employees: number; selected: number;
    passed: number; failed: number; open: number; remaining: number;
  }[];
};
type RunResult = {
  cycle: string; dryRun: boolean; totalSelected: number;
  results: { department: string; eligibleBefore: number; selected: { employeeCode: string; name: string }[] }[];
};
type Assignment = {
  id: number; cycle: string; status: string; selected_on: string;
  employee_code: string; full_name: string; department: string; selected_by: string;
};

export default function SelectionPage({ readOnly }: { readOnly: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [dept, setDept] = useState("");
  const [count, setCount] = useState("");
  const [run, setRun] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/selection/status").then(r => r.json()).then(setStatus);
    fetch("/api/assignments").then(r => r.json()).then(setAssignments);
  }, []);
  useEffect(load, [load]);

  async function doRun(dryRun: boolean) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/selection/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        department: dept || null,
        count: count ? Number(count) : null,
        dryRun,
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(body.detail ?? "Selection failed");
      return;
    }
    setRun(body);
    if (!dryRun) load();
  }

  async function cancel(id: number) {
    const reason = window.prompt("Cancellation reason (required, goes to the audit log):");
    if (!reason?.trim()) return;
    const res = await fetch(`/api/assignments/${id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) setError((await res.json()).detail ?? "Cancel failed");
    load();
  }

  return (
    <section>
      {status && (
        <div className="panel">
          <h2>Cycle {status.cycle} — {status.monthsRemaining} month{status.monthsRemaining === 1 ? "" : "s"} remaining</h2>
          <p className="hint">Every active employee must be selected once per half-year cycle
            (2 exams/year). Passed or already-selected employees are excluded automatically.</p>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Department</th><th className="num">Active</th><th className="num">Selected</th>
                    <th className="num">Passed</th><th className="num">Failed</th>
                    <th className="num">Open</th><th className="num">Still to select</th></tr>
              </thead>
              <tbody>
                {status.departments.map(d => (
                  <tr key={d.department}>
                    <td>{d.department}</td>
                    <td className="num">{d.active_employees}</td>
                    <td className="num">{d.selected}</td>
                    <td className="num">{d.passed}</td>
                    <td className="num">{d.failed}</td>
                    <td className="num">{d.open}</td>
                    <td className="num">{d.remaining > 0 ? <strong>{d.remaining}</strong> : "✓ 0"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!readOnly && status && (
        <div className="panel">
          <h2>Run monthly selection</h2>
          <p className="hint">Leave count empty for the recommended pace
            (remaining ÷ months left, per department). Preview first — nothing is
            saved until you confirm.</p>
          <div className="row">
            <select value={dept} onChange={e => setDept(e.target.value)}>
              <option value="">All departments</option>
              {status.departments.map(d => (
                <option key={d.department} value={d.department}>{d.department}</option>
              ))}
            </select>
            <input type="number" min="1" placeholder="Count (auto)" value={count}
              style={{ width: 110 }} onChange={e => setCount(e.target.value)} />
            <button className="ghost" disabled={busy} onClick={() => doRun(true)}>Preview</button>
            <button disabled={busy || !run?.dryRun} onClick={() => doRun(false)}
              title="Run a preview first">Confirm selection</button>
          </div>
          {run && (
            <div className={`result ${run.dryRun ? "warn" : "good"}`}>
              <strong>{run.dryRun ? "Preview" : "Selected"} — {run.totalSelected} employee(s):</strong>
              <ul>
                {run.results.filter(r => r.selected.length).map(r => (
                  <li key={r.department}>
                    {r.department}: {r.selected.map(s => `${s.name} (${s.employeeCode})`).join(", ")}
                  </li>
                ))}
              </ul>
              {run.dryRun && <p>Nothing saved yet — press “Confirm selection” to commit exactly this picture (a fresh random draw runs on confirm).</p>}
            </div>
          )}
          {error && <div className="result warn">{error}</div>}
        </div>
      )}

      <div className="panel">
        <h2>Assignments this cycle ({assignments.length})</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Employee</th><th>Department</th><th>Selected on</th><th>Status</th>
                  <th>By</th>{!readOnly && <th></th>}</tr>
            </thead>
            <tbody>
              {assignments.map(a => (
                <tr key={a.id} className={a.status === "cancelled" ? "dim" : ""}>
                  <td>{a.full_name} ({a.employee_code})</td>
                  <td>{a.department}</td>
                  <td>{a.selected_on}</td>
                  <td><span className={`chip ${a.status === "passed" ? "approved" : a.status === "failed" ? "rejected" : a.status === "cancelled" ? "retired" : "pending"}`}>{a.status}</span></td>
                  <td>{a.selected_by}</td>
                  {!readOnly && (
                    <td>{a.status === "assigned" &&
                      <button className="link" onClick={() => cancel(a.id)}>cancel</button>}</td>
                  )}
                </tr>
              ))}
              {assignments.length === 0 && (
                <tr><td colSpan={6} className="dim">No selections yet this cycle.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
