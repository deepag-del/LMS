# Module 4 — Question Bank & Approval Workflow: How to Use

## The workflow (LOCKED rule: submit → C-level approve → live)

1. **Dept manager** (question author) opens the **Question bank** tab. Their view is scoped to their own department — enforced server-side via their employee record's department, not by anything the browser sends.
2. They register the department's SOPs once (number + title), then submit questions: text, exactly 4 distinct options, one marked correct, tagged to a registered SOP.
3. **C-level** sees pending questions first in their queue, with the correct answer marked, and approves or rejects. A rejection **requires a comment** — it is shown to the author.
4. Rejected questions can be edited and resubmitted (version increments, review history resets, back to pending).
5. **Approved questions are frozen.** They cannot be edited — only retired (C-level or HR/Admin) and replaced with a new submission. This guarantees that any recorded exam answer forever points at the exact question text the candidate saw.
6. **Bank readiness** table shows every department's approved count against the 50-question target (the target reads from `QUESTIONS_PER_DEPT_BANK` in `.env`), plus pending/rejected counts, with a progress meter.

## Who can do what

| Action | dept_manager | c_level | hr_admin | qa |
|---|---|---|---|---|
| Register SOPs | own dept | — | any dept | — |
| Submit / edit (pending, rejected) questions | own dept | — | — | — |
| Approve / reject pending | — | yes | — | — |
| Retire approved | — | yes | yes | — |
| View questions + bank status | own dept | all | all | all (read-only) |

Employees and managers have no access to the question bank at all — they never see questions outside a live exam (Module 6 strips correct answers from exam delivery).

Everything is audited: `sop.added`, `question.submitted`, `question.updated`, `question.approved`, `question.rejected` (with comment), `question.retired`.

## Production rollout

Same update procedure as before (pull → `npm install` → `npm run migrate` → build → `pm2 restart` → rebuild client). `003_question_bank.sql` adds the `sops` and `questions` tables.

Then, per department:
1. HR provisions one **dept_manager** login per department — **from the roster** (the employee link is what scopes their authoring to the right department).
2. HR provisions the **C-level** account(s) — these can be non-roster logins (email + name).
3. Dept managers register their SOP list and start submitting; C-level works the pending queue; HR watches the readiness table climb toward 50 per department.

## Module 4 completion checklist

- [ ] One dept_manager provisioned per department (roster-linked), C-level account(s) created
- [ ] Each department's SOP list registered
- [ ] Trial run in each department: submit → reject with comment → edit/resubmit → approve
- [ ] Confirm a dept manager cannot see or edit another department's questions
- [ ] Confirm an approved question refuses editing ("retire and replace" message)
- [ ] Bank readiness table moving toward 50 approved per department — the selection engine (Module 5) should not go live for a department below target, or draws will repeat questions too often
