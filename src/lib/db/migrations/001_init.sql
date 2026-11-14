-- FinSight-AI schema. Customer and transaction values are stored as ciphertext
-- sealed by the application; identifiers are keyed blind indexes.

CREATE TABLE ingestions (
  id              text PRIMARY KEY,
  source_commit   text,
  source_file     text NOT NULL,
  source_sha256   text NOT NULL,
  status          text NOT NULL CHECK (status IN ('running', 'complete', 'failed')),
  customer_count  integer NOT NULL DEFAULT 0,
  row_count       integer NOT NULL DEFAULT 0,
  started_at      timestamptz NOT NULL DEFAULT now(),
  finished_at     timestamptz
);

-- One row per customer: the profile and the full transaction ledger, each
-- compressed and sealed with that customer's own key.
CREATE TABLE customer_ledgers (
  customer_ref    text PRIMARY KEY,
  key_id          text NOT NULL,
  ingestion_id    text NOT NULL REFERENCES ingestions (id),
  sealed_profile  text NOT NULL,
  sealed_ledger   text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Only a hash of the session token is stored.
CREATE TABLE sessions (
  token_hash      text PRIMARY KEY,
  customer_ref    text NOT NULL REFERENCES customer_ledgers (customer_ref) ON DELETE CASCADE,
  sealed_state    text,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

-- Per-customer application state (assumptions, overrides, dashboard, goals,
-- notifications), sealed with the customer's key.
CREATE TABLE customer_state (
  customer_ref    text NOT NULL REFERENCES customer_ledgers (customer_ref) ON DELETE CASCADE,
  kind            text NOT NULL,
  sealed_value    text NOT NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (customer_ref, kind)
);

-- Anonymous aggregates across the whole dataset. No row describes a person:
-- each is a percentile over a group, and small groups are not stored.
CREATE TABLE peer_benchmarks (
  ingestion_id    text NOT NULL REFERENCES ingestions (id),
  age_band        text NOT NULL,
  metric          text NOT NULL,
  group_size      integer NOT NULL,
  p25_cents       bigint NOT NULL,
  p50_cents       bigint NOT NULL,
  p75_cents       bigint NOT NULL,
  PRIMARY KEY (ingestion_id, age_band, metric)
);
