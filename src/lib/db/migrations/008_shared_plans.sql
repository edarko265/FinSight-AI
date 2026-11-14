-- Plans customers chose to share: a name and percentages only. A row holds no
-- customer reference, so a shared plan cannot be traced back to who shared it;
-- the owner's own (sealed) copy remembers the code. The content is sealed with
-- a service key like everything else at rest.
CREATE TABLE shared_plans (
  code         text PRIMARY KEY,
  sealed_plan  text NOT NULL,
  listed       boolean NOT NULL DEFAULT false,
  copies       integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shared_plans_listed_idx ON shared_plans (listed, copies DESC);
