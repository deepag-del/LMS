import { useCallback, useEffect, useState } from "react";
import { User } from "../auth";

type Sop = { id: number; sop_number: string; title: string; department: string };
type Question = {
  id: number;
  question_text: string;
  options: string[];
  correct_index: number;
  status: "pending" | "approved" | "rejected" | "retired";
  version: number;
  review_comment: string | null;
  department: string;
  sop_number: string;
  sop_title: string;
  created_by: string;
  reviewed_by: string | null;
};
type BankStatus = {
  target: number;
  departments: { department: string; approved: number; pending: number; rejected: number; sops: number }[];
};

const emptyForm = { sopId: "", questionText: "", options: ["", "", "", ""], correctIndex: 0 };

export default function QuestionsPage({ me }: { me: User }) {
  const isAuthor = me.role === "dept_manager";
  const isReviewer = me.role === "c_level";
  const canRetire = me.role === "c_level" || me.role === "hr_admin";

  const [bank, setBank] = useState<BankStatus | null>(null);
  const [sops, setSops] = useState<Sop[]>([]);
  const [rows, setRows] = useState<Question[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [form, setForm] = useState({ ...emptyForm, options: [...emptyForm.options] });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newSop, setNewSop] = useState({ sopNumber: "", title: "" });
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<{ id: number; comment: string } | null>(null);

  const load = useCallback(() => {
    fetch("/api/questions/bank-status").then(r => r.json()).then(setBank);
    fetch("/api/sops").then(r => r.json()).then(setSops);
    const q = statusFilter ? `?status=${statusFilter}` : "";
    fetch(`/api/questions${q}`).then(r => r.json()).then(setRows);
  }, [statusFilter]);
  useEffect(load, [load]);

  async function call(path: string, init?: RequestInit): Promise<Record<string, unknown> | null> {
    setNotice(null);
    setError(null);
    const res = await fetch(path, init);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError((body as { detail?: string }).detail ?? "Request failed");
      return null;
    }
    load();
    return body;
  }
  const json = (body: unknown): RequestInit => ({
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  async function addSop() {
    const body = await call("/api/sops", json(newSop));
    if (body) {
      setNewSop({ sopNumber: "", title: "" });
      setNotice("SOP registered");
    }
  }

  async function submitQuestion() {
    const payload = {
      sopId: Number(form.sopId),
      questionText: form.questionText,
      options: form.options,
      correctIndex: form.correctIndex,
    };
    const body = editingId
      ? await call(`/api/questions/${editingId}`, { ...json(payload), method: "PUT" })
      : await call("/api/questions", json(payload));
    if (body) {
      setForm({ ...emptyForm, options: [...emptyForm.options] });
      setEditingId(null);
      setNotice(editingId ? "Question resubmitted for approval" : "Question submitted for C-level approval");
    }
  }

  function startEdit(q: Question) {
    const sop = sops.find(s => s.sop_number === q.sop_number);
    setEditingId(q.id);
    setForm({
      sopId: sop ? String(sop.id) : "",
      questionText: q.question_text,
      options: [...q.options],
      correctIndex: q.correct_index,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const chip = (s: Question["status"]) => <span className={`chip ${s}`}>{s}</span>;

  return (
    <section>
      {bank && (
        <div className="panel">
          <h2>Bank readiness — target {bank.target} approved questions per department</h2>
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Department</th><th className="num">SOPs</th><th className="num">Approved</th>
                    <th className="num">Pending</th><th className="num">Rejected</th><th>Progress</th></tr>
              </thead>
              <tbody>
                {bank.departments.map(d => (
                  <tr key={d.department}>
                    <td>{d.department}</td>
                    <td className="num">{d.sops}</td>
                    <td className="num">{d.approved}</td>
                    <td className="num">{d.pending}</td>
                    <td className="num">{d.rejected}</td>
                    <td>
                      <div className="meter" role="img"
                        aria-label={`${d.approved} of ${bank.target} approved`}>
                        <div className="meter-fill"
                          style={{ width: `${Math.min(100, (d.approved / bank.target) * 100)}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isAuthor && (
        <div className="panel">
          <h2>{editingId ? `Edit question #${editingId}` : "Submit a question"}</h2>
          <p className="hint">Questions go live only after C-level approval. Tag each question to
            the SOP it tests. Register the SOP first if it is not in the list.</p>
          <div className="row" style={{ marginBottom: 10 }}>
            <select value={form.sopId} onChange={e => setForm({ ...form, sopId: e.target.value })}>
              <option value="">Select SOP…</option>
              {sops.map(s => <option key={s.id} value={s.id}>{s.sop_number} — {s.title}</option>)}
            </select>
            <input type="text" placeholder="New SOP number (e.g. SOP-MC-014)" value={newSop.sopNumber}
              onChange={e => setNewSop({ ...newSop, sopNumber: e.target.value })} style={{ width: 190 }} />
            <input type="text" placeholder="New SOP title" value={newSop.title}
              onChange={e => setNewSop({ ...newSop, title: e.target.value })} />
            <button className="ghost" disabled={!newSop.sopNumber.trim() || !newSop.title.trim()}
              onClick={addSop}>Register SOP</button>
          </div>
          <textarea rows={2} placeholder="Question text"
            value={form.questionText}
            onChange={e => setForm({ ...form, questionText: e.target.value })} />
          {form.options.map((o, i) => (
            <div className="row" key={i} style={{ marginTop: 6 }}>
              <label className="chk">
                <input type="radio" name="correct" checked={form.correctIndex === i}
                  onChange={() => setForm({ ...form, correctIndex: i })} />
                correct
              </label>
              <input type="text" placeholder={`Option ${String.fromCharCode(65 + i)}`} value={o}
                style={{ flex: 1 }}
                onChange={e => {
                  const options = [...form.options];
                  options[i] = e.target.value;
                  setForm({ ...form, options });
                }} />
            </div>
          ))}
          <div className="row" style={{ marginTop: 10 }}>
            <button disabled={!form.sopId || !form.questionText.trim() || form.options.some(o => !o.trim())}
              onClick={submitQuestion}>
              {editingId ? "Resubmit for approval" : "Submit for approval"}
            </button>
            {editingId && (
              <button className="ghost" onClick={() => {
                setEditingId(null);
                setForm({ ...emptyForm, options: [...emptyForm.options] });
              }}>Cancel edit</button>
            )}
          </div>
        </div>
      )}

      {notice && <div className="result good">{notice}</div>}
      {error && <div className="result warn">{error}</div>}

      <div className="panel">
        <div className="row spread">
          <h2>{isReviewer ? "Questions (pending first)" : "Questions"} ({rows.length})</h2>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="retired">Retired</option>
          </select>
        </div>
        {rows.map(q => (
          <div className="qcard" key={q.id}>
            <div className="row spread">
              <div>
                <strong>#{q.id}</strong> · {q.department} · {q.sop_number} ({q.sop_title}) · v{q.version} {chip(q.status)}
              </div>
              <div className="row">
                {isAuthor && ["pending", "rejected"].includes(q.status) && (
                  <button className="link" onClick={() => startEdit(q)}>edit</button>
                )}
                {isReviewer && q.status === "pending" && (
                  <>
                    <button onClick={() => call(`/api/questions/${q.id}/review`, json({ decision: "approve" }))}>
                      Approve
                    </button>
                    <button className="ghost" onClick={() => setRejecting({ id: q.id, comment: "" })}>
                      Reject…
                    </button>
                  </>
                )}
                {canRetire && q.status === "approved" && (
                  <button className="link" onClick={() => call(`/api/questions/${q.id}/retire`, json({}))}>
                    retire
                  </button>
                )}
              </div>
            </div>
            <p className="qtext">{q.question_text}</p>
            <ol className="qopts" type="A">
              {q.options.map((o, i) => (
                <li key={i} className={i === q.correct_index ? "correct" : ""}>
                  {o}{i === q.correct_index && " ✓"}
                </li>
              ))}
            </ol>
            <p className="hint">by {q.created_by}
              {q.reviewed_by && <> · reviewed by {q.reviewed_by}</>}
              {q.review_comment && <> · comment: “{q.review_comment}”</>}
            </p>
            {rejecting?.id === q.id && (
              <div className="row">
                <input type="text" style={{ flex: 1 }} autoFocus
                  placeholder="Why is this rejected? (required — shown to the author)"
                  value={rejecting.comment}
                  onChange={e => setRejecting({ id: q.id, comment: e.target.value })} />
                <button disabled={!rejecting.comment.trim()}
                  onClick={async () => {
                    await call(`/api/questions/${q.id}/review`, json({ decision: "reject", comment: rejecting.comment }));
                    setRejecting(null);
                  }}>Confirm reject</button>
                <button className="ghost" onClick={() => setRejecting(null)}>Cancel</button>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="dim">No questions yet.</p>}
      </div>
    </section>
  );
}
