import { useEffect, useState } from "react";

type Assignment = { id: number; cycle: string; status: string; selected_on: string };

const STATUS_TEXT: Record<string, string> = {
  assigned: "Selected — your exam slot will be emailed to you (exam engine arrives in Module 6)",
  in_progress: "Exam in progress",
  passed: "Passed ✓ — certificate will be available once the certificate module goes live",
  failed: "Not cleared — a retest will be scheduled automatically",
  cancelled: "Cancelled by HR",
};

export default function MyExamsPage() {
  const [rows, setRows] = useState<Assignment[] | null>(null);

  useEffect(() => {
    fetch("/api/my/assignments").then(r => r.json()).then(setRows);
  }, []);

  return (
    <div className="panel">
      <h2>My exams</h2>
      {rows === null && <p className="pending">Loading…</p>}
      {rows?.length === 0 && (
        <p className="hint">You have not been selected for an exam yet in the current cycle.
          Everyone sits two SOP compliance exams per year; you will be notified by email
          when your turn comes.</p>
      )}
      {rows && rows.length > 0 && (
        <div className="tablewrap">
          <table>
            <thead><tr><th>Cycle</th><th>Selected on</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map(a => (
                <tr key={a.id}>
                  <td>{a.cycle}</td>
                  <td>{a.selected_on}</td>
                  <td>{STATUS_TEXT[a.status] ?? a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
