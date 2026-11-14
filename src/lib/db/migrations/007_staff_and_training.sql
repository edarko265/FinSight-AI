-- Staff who can sign in to the admin area besides the installation owner:
-- administrators, advisers and personal bankers. The name, username and role
-- are sealed; the username is looked up through a keyed digest; the password
-- is kept only as a salted scrypt hash.
CREATE TABLE staff_users (
  id              text PRIMARY KEY,
  username_index  text NOT NULL UNIQUE,
  sealed_profile  text NOT NULL,
  password_hash   text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  deleted_at      timestamptz
);

-- Who did it: a staff id, or 'owner'. The name is resolved when the log is read.
ALTER TABLE admin_audit ADD COLUMN actor text NOT NULL DEFAULT '';

-- Answers staff have written for questions the coach had no calculation for.
-- Bank-written text shown to every customer who asks; no customer data.
CREATE TABLE coach_answers (
  id          text PRIMARY KEY,
  theme       text NOT NULL,
  keywords    text NOT NULL DEFAULT '',
  answer_en   text NOT NULL DEFAULT '',
  answer_fi   text NOT NULL DEFAULT '',
  answer_sv   text NOT NULL DEFAULT '',
  uses        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);
