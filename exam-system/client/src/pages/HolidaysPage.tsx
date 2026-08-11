import { useCallback, useEffect, useState } from "react";

type Holiday = { id: number; holiday_date: string; name: string };

export default function HolidaysPage() {
  const [rows, setRows] = useState<Holiday[]>([]);
  const [date, setDate] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/holidays").then(r => r.json()).then(setRows);
  }, []);
  useEffect(load, [load]);

  async function add() {
    setError(null);
    const res = await fetch("/api/holidays", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, name }),
    });
    if (!res.ok) {
      setError((await res.json()).detail ?? "Failed to add holiday");
      return;
    }
    setDate("");
    setName("");
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/holidays/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <section>
      <div className="panel">
        <h2>Holiday calendar</h2>
        <p className="hint">
          Retest auto-scheduling (Module 7) skips Saturdays, Sundays, and every date listed here.
          Fixed national holidays are pre-seeded; add festival dates (Holi, Diwali…) each year.
        </p>
        <div className="row">
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input
            type="text"
            placeholder="Holiday name"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button disabled={!date || !name.trim()} onClick={add}>Add holiday</button>
        </div>
        {error && <p className="fail">{error}</p>}
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Name</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(h => (
                <tr key={h.id}>
                  <td>{h.holiday_date}</td>
                  <td>{h.name}</td>
                  <td><button className="link" onClick={() => remove(h.id)}>remove</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={3} className="dim">No holidays configured.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
