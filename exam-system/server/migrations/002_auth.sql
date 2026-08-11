-- Module 3: users, roles, and server-side sessions.

CREATE TABLE users (
  id                    serial PRIMARY KEY,
  employee_id           int UNIQUE REFERENCES employees(id),
  email                 text NOT NULL,
  full_name             text NOT NULL,
  role                  text NOT NULL CHECK (role IN
                          ('employee', 'manager', 'dept_manager', 'c_level', 'hr_admin', 'qa')),
  password_hash         text NOT NULL,
  must_change_password  boolean NOT NULL DEFAULT true,
  active                boolean NOT NULL DEFAULT true,
  failed_attempts       int NOT NULL DEFAULT 0,
  locked_until          timestamptz,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_key ON users (lower(email));

-- One row per issued session token (we store only the SHA-256 hash of the token).
-- LOCKED rule "single active session per login": creating a new session revokes
-- all other live sessions for that user.
CREATE TABLE sessions (
  token_hash   text PRIMARY KEY,
  user_id      int NOT NULL REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  revoked_at   timestamptz,
  ip           text,
  user_agent   text
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
