import { useCallback, useEffect, useState } from "react";

type Employee = {
  id: number;
  employee_code: string;
  full_name: string;
  email: string;
  department: string;
  designation: string | null;
  manager_email: string | null;
  date_of_joining: string | null;
  status: string;
};

type Dept = { id: number; name: string; active_employees: number };

type ImportSummary = {
  ok: boolean;
  mode: string;
  dryRun: boolean;
  totalRowsInFile: number;
  created: number;
  updated: number;
  unchanged: number;
  deactivated: number;
  errorCount: number;
  errors: { rowNumber: number; message: string }[];
};

export default function EmployeesPage({ readOnly = false }: { readOnly?: boolean }) {
  const [depts, setDepts] = useState<Dept[]>([]);
  const [deptFilter, setDeptFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [rows, setRows] = useState<Employee[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"upsert" | "full">("upsert");
  const [dryRun, setDryRun] = useState(true);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const load = useCallback(() => {
    fetch("/api/departments").then(r => r.json()).then(setDepts);
    const q = new URLSearchParams();
    if (deptFilter) q.set("department", deptFilter);
    q.set("status", statusFilter);
    fetch(`/api/employees?${q}`).then(r => r.json()).then(setRows);
  }, [deptFilter, statusFilter]);

  useEffect(load, [load]);

  async function runImport() {
    if (!file) return;
    setBusy(true);
    setSummary(null);
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/api/admin/import/employees?mode=${mode}&dryRun=${dryRun}`, {
      method: "POST",
      body,
    });
    setSummary(await res.json());
    setBusy(false);
    load();
  }

  return (
    <section>
      {!readOnly && <div className="panel">
        <h2>Import roster (.xlsx)</h2>
        <p className="hint">
          Columns: Employee Code, Name, Email, Department, Designation, Manager Email, Date of
          Joining — a ready template is in <code>exam-system/docs/roster-template.xlsx</code>.
          Run with <em>dry run</em> first to preview; nothing is written until you untick it.
        </p>
        <div className="row">
          <input type="file" accept=".xlsx" onChange={e => setFile(e.target.files?.[0] ?? null)} />
          <select value={mode} onChange={e => setMode(e.target.value as "upsert" | "full")}>
            <option value="upsert">Add &amp; update only (partial file OK)</option>
            <option value="full">Full roster (deactivate missing employees)</option>
          </select>
          <label className="chk">
            <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)} />
            Dry run
          </label>
          <button disabled={!file || busy} onClick={runImport}>
            {busy ? "Importing…" : dryRun ? "Preview import" : "Import"}
          </button>
        </div>
        {summary && (
          <div className={summary.errorCount ? "result warn" : "result good"}>
            <strong>{summary.dryRun ? "Preview" : "Imported"}:</strong>{" "}
            {summary.created} new, {summary.updated} updated, {summary.unchanged} unchanged
            {summary.mode === "full" && <>, {summary.deactivated} deactivated</>}
            {summary.errorCount > 0 && <>, {summary.errorCount} row error(s)</>}
            {summary.errors.length > 0 && (
              <ul>
                {summary.errors.map((e, i) => (
                  <li key={i}>Row {e.rowNumber}: {e.message}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>}

      <div className="panel">
        <div className="row spread">
          <h2>Employees ({rows.length})</h2>
          <div className="row">
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
              <option value="">All departments</option>
              {depts.map(d => (
                <option key={d.id} value={d.name}>{d.name} ({d.active_employees})</option>
              ))}
            </select>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="all">All</option>
            </select>
          </div>
        </div>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>Email</th><th>Department</th>
                <th>Designation</th><th>Manager</th><th>Joined</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(e => (
                <tr key={e.id} className={e.status === "inactive" ? "dim" : ""}>
                  <td>{e.employee_code}</td>
                  <td>{e.full_name}</td>
                  <td>{e.email}</td>
                  <td>{e.department}</td>
                  <td>{e.designation ?? "—"}</td>
                  <td>{e.manager_email ?? "—"}</td>
                  <td>{e.date_of_joining ?? "—"}</td>
                  <td>{e.status}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="dim">No employees yet — import a roster above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
