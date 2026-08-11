import { useCallback, useEffect, useState } from "react";
import { ROLE_LABELS, User } from "../auth";

type Row = {
  id: number;
  email: string;
  full_name: string;
  role: User["role"];
  active: boolean;
  must_change_password: boolean;
  employee_code: string | null;
  department: string | null;
};

type Employee = { id: number; full_name: string; employee_code: string; department: string };

const ROLES = Object.keys(ROLE_LABELS) as User["role"][];

export default function UsersPage({ me, readOnly }: { me: User; readOnly: boolean }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pickEmployee, setPickEmployee] = useState("");
  const [pickRole, setPickRole] = useState<User["role"]>("employee");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/users").then(r => r.json()).then(setRows);
    if (!readOnly) fetch("/api/employees").then(r => r.json()).then(setEmployees);
  }, [readOnly]);
  useEffect(load, [load]);

  async function call(path: string, init?: RequestInit) {
    setNotice(null);
    setError(null);
    const res = await fetch(path, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.detail ?? "Request failed");
      return null;
    }
    load();
    return body;
  }

  async function provision() {
    const body = await call("/api/users/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId: Number(pickEmployee), role: pickRole }),
    });
    if (body?.tempPassword) {
      setNotice(`Account created. One-time password (copy it NOW — it is never shown again): ${body.tempPassword}`);
    } else if (body) {
      setNotice("Account created; the one-time password was emailed to the employee.");
    }
  }

  async function resetPassword(id: number) {
    const body = await call(`/api/users/${id}/reset-password`, { method: "POST" });
    if (body?.tempPassword) {
      setNotice(`Password reset. One-time password (copy it NOW): ${body.tempPassword}`);
    } else if (body) {
      setNotice("Password reset; the one-time password was emailed.");
    }
  }

  const withoutLogin = employees.filter(e => !rows.some(r => r.employee_code === e.employee_code));

  return (
    <section>
      {!readOnly && (
        <div className="panel">
          <h2>Provision a login</h2>
          <p className="hint">Pick an imported employee and their role. A one-time password is
            generated; the employee sets their own on first sign-in.</p>
          <div className="row">
            <select value={pickEmployee} onChange={e => setPickEmployee(e.target.value)}>
              <option value="">Select employee…</option>
              {withoutLogin.map(e => (
                <option key={e.id} value={e.id}>{e.full_name} ({e.employee_code}, {e.department})</option>
              ))}
            </select>
            <select value={pickRole} onChange={e => setPickRole(e.target.value as User["role"])}>
              {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button disabled={!pickEmployee} onClick={provision}>Create account</button>
          </div>
        </div>
      )}
      {notice && <div className="result good">{notice}</div>}
      {error && <div className="result warn">{error}</div>}

      <div className="panel">
        <h2>User accounts ({rows.length})</h2>
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Employee</th><th>Role</th><th>Status</th>
                {!readOnly && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map(u => (
                <tr key={u.id} className={u.active ? "" : "dim"}>
                  <td>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>{u.employee_code ? `${u.employee_code} · ${u.department}` : "—"}</td>
                  <td>
                    {!readOnly && u.id !== me.id ? (
                      <select value={u.role}
                        onChange={e => call(`/api/users/${u.id}/role`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ role: e.target.value }),
                        })}>
                        {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                      </select>
                    ) : ROLE_LABELS[u.role]}
                  </td>
                  <td>{u.active ? (u.must_change_password ? "awaiting first sign-in" : "active") : "deactivated"}</td>
                  {!readOnly && (
                    <td className="row">
                      <button className="link" onClick={() => resetPassword(u.id)}>reset password</button>
                      {u.id !== me.id && (
                        <button className="link" onClick={() => call(`/api/users/${u.id}/active`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ active: !u.active }),
                        })}>{u.active ? "deactivate" : "reactivate"}</button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
