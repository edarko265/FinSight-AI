-- Things staff control without a deploy: feature switches, the adviser fee,
-- reward rules and the daily AI budget. One JSON document per key.
CREATE TABLE app_settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- What staff did and when. No customer data is written here.
CREATE TABLE admin_audit (
  id      text PRIMARY KEY,
  at      timestamptz NOT NULL DEFAULT now(),
  action  text NOT NULL,
  detail  text NOT NULL DEFAULT ''
);
CREATE INDEX admin_audit_at_idx ON admin_audit (at DESC);

-- AI consumption per day and model: request and token counts only.
CREATE TABLE ai_usage (
  day            date    NOT NULL,
  model          text    NOT NULL,
  requests       integer NOT NULL DEFAULT 0,
  input_tokens   bigint  NOT NULL DEFAULT 0,
  output_tokens  bigint  NOT NULL DEFAULT 0,
  PRIMARY KEY (day, model)
);

-- How many customers have seen each announcement.
ALTER TABLE announcements ADD COLUMN views integer NOT NULL DEFAULT 0;
