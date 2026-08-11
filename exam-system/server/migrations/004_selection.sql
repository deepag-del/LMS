-- Module 5: selection engine.
-- One assignment row per employee per half-year cycle (LOCKED rules: exactly 2
-- exams per employee per year; once passed, excluded from selection until the
-- next cycle). The UNIQUE constraint is the exclusion rule, enforced by Postgres.

CREATE TABLE exam_assignments (
  id            serial PRIMARY KEY,
  employee_id   int NOT NULL REFERENCES employees(id),
  department_id int NOT NULL REFERENCES departments(id),
  cycle         text NOT NULL,               -- e.g. '2026-H1', '2026-H2'
  status        text NOT NULL DEFAULT 'assigned'
                  CHECK (status IN ('assigned', 'in_progress', 'passed', 'failed', 'cancelled')),
  selected_at   timestamptz NOT NULL DEFAULT now(),
  selected_by   int NOT NULL REFERENCES users(id),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, cycle)
);
CREATE INDEX exam_assignments_cycle_idx ON exam_assignments (cycle, department_id, status);
