-- Module 4: SOP registry + question bank with approval workflow.

-- Each question is tagged to a specific SOP (LOCKED rule). SOPs are registered
-- per department so tags are consistent, not free-typed.
CREATE TABLE sops (
  id            serial PRIMARY KEY,
  department_id int NOT NULL REFERENCES departments(id),
  sop_number    text NOT NULL,
  title         text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, sop_number)
);

-- Question lifecycle: pending -> approved | rejected; rejected -> (edit) -> pending;
-- approved -> retired. Approved questions are never edited in place — they are
-- retired and replaced, so any recorded exam answer keeps pointing at the exact
-- text the candidate saw (audit requirement).
CREATE TABLE questions (
  id             serial PRIMARY KEY,
  department_id  int NOT NULL REFERENCES departments(id),
  sop_id         int NOT NULL REFERENCES sops(id),
  question_text  text NOT NULL,
  options        jsonb NOT NULL,           -- array of exactly 4 option strings
  correct_index  int NOT NULL CHECK (correct_index BETWEEN 0 AND 3),
  status         text NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'approved', 'rejected', 'retired')),
  version        int NOT NULL DEFAULT 1,
  created_by     int NOT NULL REFERENCES users(id),
  reviewed_by    int REFERENCES users(id),
  reviewed_at    timestamptz,
  review_comment text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX questions_dept_status_idx ON questions (department_id, status);
CREATE INDEX questions_sop_idx ON questions (sop_id);
