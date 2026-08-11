-- Module 2: data foundation — departments, employees, holidays, import runs,
-- and the append-only audit log (created early because imports are auditable actions).

CREATE TABLE departments (
  id          serial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE employees (
  id              serial PRIMARY KEY,
  employee_code   text NOT NULL UNIQUE,
  full_name       text NOT NULL,
  email           text NOT NULL,
  department_id   int NOT NULL REFERENCES departments(id),
  designation     text,
  manager_email   text,
  date_of_joining date,
  status          text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX employees_email_key ON employees (lower(email));
CREATE INDEX employees_department_idx ON employees (department_id);

CREATE TABLE holidays (
  id            serial PRIMARY KEY,
  holiday_date  date NOT NULL UNIQUE,
  name          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE import_runs (
  id                 serial PRIMARY KEY,
  filename           text,
  mode               text NOT NULL CHECK (mode IN ('upsert', 'full')),
  dry_run            boolean NOT NULL,
  created_count      int NOT NULL DEFAULT 0,
  updated_count      int NOT NULL DEFAULT 0,
  deactivated_count  int NOT NULL DEFAULT 0,
  error_count        int NOT NULL DEFAULT 0,
  errors             jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Append-only audit trail (LOCKED rule: no edits or deletes, ever).
-- The trigger makes UPDATE/DELETE fail at the database level, so even a bug
-- or a rogue admin query cannot rewrite history.
CREATE TABLE audit_log (
  id         bigserial PRIMARY KEY,
  at         timestamptz NOT NULL DEFAULT now(),
  actor      text NOT NULL DEFAULT 'system',
  action     text NOT NULL,
  entity     text,
  entity_id  text,
  details    jsonb
);
CREATE INDEX audit_log_at_idx ON audit_log (at);
CREATE INDEX audit_log_entity_idx ON audit_log (entity, entity_id);

CREATE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % blocked', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_rewrite
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- Seed: the seven confirmed departments (LOCKED list; extendable via API later).
INSERT INTO departments (name) VALUES
  ('Analytical R&D'),
  ('MedChem'),
  ('Process R&D'),
  ('QA'),
  ('CADD'),
  ('NCE'),
  ('ANDA')
ON CONFLICT (name) DO NOTHING;

-- Seed: fixed-date national holidays for 2026 as a starting point.
-- Festival dates (Holi, Diwali, etc.) vary by year — HR adds them in the Holidays screen.
INSERT INTO holidays (holiday_date, name) VALUES
  ('2026-01-26', 'Republic Day'),
  ('2026-08-15', 'Independence Day'),
  ('2026-10-02', 'Gandhi Jayanti')
ON CONFLICT (holiday_date) DO NOTHING;
